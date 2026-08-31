import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";

type Started = { server: Server; origin: string };
let supabase: Started;
let api: Started;
const rpcCalls: Array<Record<string, unknown>> = [];

function listen(server: Server): Promise<Started> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    resolve({ server, origin: `http://127.0.0.1:${address.port}` });
  }));
}
function webhook(body: unknown, authorization?: string) {
  return fetch(`${api.origin}/api/webhooks/revenuecat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });
}
const event = {
  api_version: "1.0",
  event: {
    id: "rc-event-1", type: "INITIAL_PURCHASE",
    app_user_id: "11111111-1111-4111-8111-111111111111",
    product_id: "drop_credits_5", transaction_id: "transaction-1",
    price_in_purchased_currency: 1.99, currency: "USD",
    environment: "SANDBOX",
  },
};

describe("RevenueCat verified events", () => {
  before(async () => {
    supabase = await listen(createServer((req, res) => {
      if (req.url?.startsWith("/rest/v1/rpc/revenuecat_apply_verified_event")) {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", () => {
          rpcCalls.push(JSON.parse(raw) as Record<string, unknown>);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ success: true }));
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    }));
    process.env.SUPABASE_URL = supabase.origin;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "revenuecat-test-secret-at-least-16";
    const { default: app } = await import("../app");
    api = await listen(createServer(app));
  });
  after(async () => {
    await Promise.all([
      new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())),
      new Promise<void>((resolve, reject) => supabase.server.close((error) => error ? reject(error) : resolve())),
    ]);
  });

  it("fails closed before schema parsing when webhook authorization is absent or wrong", async () => {
    assert.equal((await webhook({ nope: true })).status, 401);
    assert.equal((await webhook(event, "wrong-secret-but-same-length-000000")).status, 401);
    assert.equal((await webhook({ event: { ...event.event, subscriber_attributes: { collectible_order_id: { value: "not-a-uuid" } } } }, process.env.REVENUECAT_WEBHOOK_AUTHORIZATION)).status, 400);
    assert.equal(rpcCalls.length, 0);
  });

  it("normalizes only a verified fixed catalog event for the trusted RPC", async () => {
    const response = await webhook(event, process.env.REVENUECAT_WEBHOOK_AUTHORIZATION);
    assert.equal(response.status, 200);
    assert.deepEqual(rpcCalls.pop(), {
      p_event_id: "rc-event-1",
      p_event_type: "INITIAL_PURCHASE",
      p_app_user_id: "11111111-1111-4111-8111-111111111111",
      p_product_id: "drop_credits_5",
      p_transaction_id: "transaction-1",
      p_collectible_order_id: null,
      p_amount_minor: 199,
      p_currency: "USD",
      p_expires_at: null,
    });
  });
});