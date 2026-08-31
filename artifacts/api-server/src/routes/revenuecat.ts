import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { supabaseAdminConfigured, supabaseAdminRpc } from "../lib/supabase-admin";

const router: IRouter = Router();
const uuid = z.string().uuid();
const subscriberAttributeSchema = z.object({
  value: z.string().max(255),
  updated_at_ms: z.number().int().nonnegative().optional(),
}).passthrough();
const eventSchema = z.object({
  id: z.string().min(1).max(255),
  type: z.enum(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "CANCELLATION", "EXPIRATION", "BILLING_ISSUE", "NON_RENEWING_PURCHASE", "REFUND"]),
  app_user_id: uuid,
  product_id: z.string().min(1).max(255),
  transaction_id: z.string().min(1).max(255).optional(),
  original_transaction_id: z.string().min(1).max(255).optional(),
  price_in_purchased_currency: z.number().finite().nonnegative().optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  expiration_at_ms: z.number().int().positive().optional(),
  subscriber_attributes: z.record(z.string(), subscriberAttributeSchema).optional(),
}).passthrough().refine(
  (event) => Boolean(event.transaction_id || event.original_transaction_id),
  { message: "A transaction identifier is required." },
);
const webhookSchema = z.object({ api_version: z.string().min(1).optional(), event: eventSchema }).passthrough();

function configuredSecret(): Buffer | null {
  const value = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  return value && value.length >= 16 ? Buffer.from(value) : null;
}
function authorized(req: Request): boolean {
  const expected = configuredSecret();
  const received = req.header("authorization");
  if (!expected || !received) return false;
  const actual = Buffer.from(received);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
router.post("/webhooks/revenuecat", async (req: Request, res: Response) => {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized webhook." });
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid RevenueCat event.", issues: parsed.error.flatten() });
  if (!supabaseAdminConfigured()) return res.status(503).json({ error: "Trusted event processing is unavailable." });
  const event = parsed.data.event;
  const collectibleOrderId = event.subscriber_attributes?.collectible_order_id?.value ?? null;
  if (collectibleOrderId !== null && !uuid.safeParse(collectibleOrderId).success) {
    return res.status(400).json({ error: "Invalid collectible order reference." });
  }
  try {
    const result = await supabaseAdminRpc<Record<string, unknown>>("revenuecat_apply_verified_event", {
      p_event_id: event.id, p_event_type: event.type, p_app_user_id: event.app_user_id,
      p_product_id: event.product_id,
      p_transaction_id: event.transaction_id ?? event.original_transaction_id!,
      p_collectible_order_id: collectibleOrderId,
      p_amount_minor: event.price_in_purchased_currency === undefined ? null : Math.round(event.price_in_purchased_currency * 100),
      p_currency: event.currency?.toUpperCase() ?? null,
      p_expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    });
    return res.status(200).json({ accepted: true, alreadyApplied: result.alreadyApplied === true });
  } catch (error) {
    // A verified but incompatible event is permanent (4xx); infrastructure and
    // database failures remain retryable for RevenueCat.
    const message = error instanceof Error ? error.message : "";
    const permanent = /unsupported_|mismatch|not_found|not_pending|invalid_revenuecat/.test(message);
    return res.status(permanent ? 422 : 503).json({ error: permanent ? "Event cannot be applied." : "Event processing failed; retry later." });
  }
});

export default router;