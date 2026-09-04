import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectibleProductId, PROVIDER_PRODUCT_MAPPINGS, REVENUE_CATALOG } from "./catalog";
import { reconciliationMatcher, reconcileExternalEvents } from "./reconciliation";
import { selectPaymentRoute } from "./routing";
import { canReceivePaidSales, mapDisputeStatus, mapPayoutStatus, mapSellerStatus } from "./status-mapping";
import type { NormalizedExternalEvent, PaymentIntent, ReconciliationSubject } from "./types";

const subject: ReconciliationSubject = {
  id: "order-1",
  subjectType: "marketplace_order",
  provider: "stripe",
  providerTransactionId: "txn-1",
  amount: { amountMinor: 500, currency: "USD" },
};

const event: NormalizedExternalEvent = {
  provider: "stripe",
  providerEventId: "evt-1",
  kind: "payment_succeeded",
  subjectType: "marketplace_order",
  subjectId: "order-1",
  providerTransactionId: "txn-1",
  amount: { amountMinor: 500, currency: "USD" },
  occurredAt: "2026-09-04T00:00:00.000Z",
  idempotencyKey: "stripe:evt-1",
};

describe("Stage 3 provider-neutral payment preparation", () => {
  it("keeps canonical prices and leaves owner store IDs explicit", () => {
    assert.deepEqual(
      Object.fromEntries(Object.entries(REVENUE_CATALOG).map(([code, item]) => [code, [item.amountMinor, item.currency, item.credits ?? null]])),
      {
        worlds_monthly: [499, "USD", null],
        worlds_yearly: [4499, "USD", null],
        drop_credits_5: [199, "USD", 5],
        drop_credits_15: [499, "USD", 15],
        drop_credits_35: [999, "USD", 35],
      },
    );
    assert.equal(PROVIDER_PRODUCT_MAPPINGS.revenuecat.worlds_monthly.providerProductId, "worlds_monthly");
    assert.equal(PROVIDER_PRODUCT_MAPPINGS.apple.worlds_monthly.providerProductId, null);
    assert.equal(PROVIDER_PRODUCT_MAPPINGS.google_play.drop_credits_5.providerProductId, null);
    assert.equal(collectibleProductId(199), "collectible_199");
    assert.throws(() => collectibleProductId(0), /positive integer/);
  });

  it("normalizes the seller, payout, and dispute lifecycle conservatively", () => {
    assert.equal(mapSellerStatus({ accountExists: false, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, requirementsDue: false, disabled: false }), "not_onboarded");
    assert.equal(mapSellerStatus({ accountExists: true, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, requirementsDue: false, disabled: false }), "onboarding_required");
    assert.equal(mapSellerStatus({ accountExists: true, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true, requirementsDue: false, disabled: false }), "active");
    assert.equal(mapSellerStatus({ accountExists: true, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true, requirementsDue: true, disabled: false }), "restricted");
    assert.equal(canReceivePaidSales("active"), true);
    assert.equal(canReceivePaidSales("pending"), false);
    assert.equal(mapPayoutStatus({ paid: false, inTransit: false, failed: true, reversed: false }), "failed");
    assert.equal(mapPayoutStatus({ paid: false, inTransit: false, failed: false, reversed: true }), "reversed");
    assert.equal(mapDisputeStatus({ opened: true, won: false, lost: false, reversed: false }), "opened");
    assert.equal(mapDisputeStatus({ opened: true, won: false, lost: true, reversed: false }), "lost");
  });

  it("selects only server-approved routes and fails closed for unmapped native or web products", () => {
    assert.deepEqual(
      selectPaymentRoute({
        platform: "ios",
        category: "membership",
        productCode: "worlds_monthly",
        providerAvailability: { apple: true },
      }),
      { status: "unavailable", provider: null, reason: "native_product_not_mapped" },
    );
    assert.deepEqual(
      selectPaymentRoute({
        platform: "android",
        category: "collectible",
        providerAvailability: { google_play: true },
        sellerStatus: "active",
      }),
      { status: "unavailable", provider: null, reason: "native_product_not_mapped" },
    );
    assert.deepEqual(
      selectPaymentRoute({
        platform: "web",
        category: "collectible",
        productCode: "drop_credits_5",
        providerAvailability: { stripe: true },
        sellerStatus: "restricted",
      }),
      { status: "unavailable", provider: null, reason: "seller_not_eligible" },
    );
    assert.deepEqual(
      selectPaymentRoute({
        platform: "web",
        category: "collectible",
        productCode: "drop_credits_5",
        providerAvailability: { stripe: true },
        sellerStatus: "active",
      }),
      { status: "unavailable", provider: null, reason: "web_product_not_mapped" },
    );
  });

  it("matches trusted events and identifies duplicates, unknowns, and mismatches", () => {
    assert.equal(reconciliationMatcher.match(event, [subject]).status, "matched");
    assert.equal(reconciliationMatcher.match(event, [subject], new Set(["stripe:evt-1"])).issueCode, "duplicate_provider_event");
    assert.equal(reconciliationMatcher.match({ ...event, subjectId: null, providerTransactionId: "txn-unknown" }, [subject]).issueCode, "unknown_external_event");
    assert.equal(reconciliationMatcher.match({ ...event, amount: { amountMinor: 499, currency: "USD" } }, [subject]).issueCode, "amount_mismatch");
    assert.equal(reconciliationMatcher.match({ ...event, amount: { amountMinor: 500, currency: "EUR" } }, [subject]).issueCode, "currency_mismatch");
    assert.deepEqual(reconcileExternalEvents([event, event], [subject]).map((item) => item.status), ["matched", "duplicate"]);
  });

  it("keeps fake payment intent idempotency local and provider-neutral", async () => {
    const intents = new Map<string, PaymentIntent>();
    const create = async (input: Omit<PaymentIntent, "id" | "status" | "providerPaymentId">): Promise<PaymentIntent> => {
      const existing = intents.get(input.idempotencyKey);
      if (existing) {
        assert.deepEqual(existing.amount, input.amount);
        return existing;
      }
      const created: PaymentIntent = {
        ...input,
        id: "intent-1",
        status: "requires_action",
        providerPaymentId: "provider-intent-1",
      };
      intents.set(input.idempotencyKey, created);
      return created;
    };
    const input = {
      idempotencyKey: "idempotency-1",
      category: "collectible" as const,
      buyerUserId: "buyer-1",
      amount: { amountMinor: 500, currency: "USD" },
      provider: "stripe" as const,
    };
    assert.equal((await create(input)).id, (await create(input)).id);
    await assert.rejects(() => create({ ...input, amount: { amountMinor: 501, currency: "USD" } }));
  });
});