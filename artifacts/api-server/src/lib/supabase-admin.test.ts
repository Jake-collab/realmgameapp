import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deleteSupabaseStorageObject } from "./supabase-admin";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

describe("Supabase Storage cleanup", () => {
  it("deletes one object using the service-role batch removal endpoint", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return new Response("{}", { status: 200 });
    };

    assert.equal(
      await deleteSupabaseStorageObject("proof-submissions", "user-id/proof-id/media-id.jpg"),
      "deleted",
    );
    assert.equal(request?.method, "DELETE");
    assert.equal(request?.url, "https://example.supabase.co/storage/v1/object/proof-submissions");
    assert.deepEqual(await request?.json(), { prefixes: ["user-id/proof-id/media-id.jpg"] });
    assert.equal(request?.headers.get("authorization"), "Bearer service-role-test-key");
  });

  it("treats a missing object as an idempotent success", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    globalThis.fetch = async () => new Response("", { status: 404 });

    assert.equal(
      await deleteSupabaseStorageObject("moderation-quarantine", "media/entity/media-id.jpg"),
      "missing",
    );
  });

  it("rejects unsafe or noncanonical references before making a request", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("", { status: 500 });
    };

    await assert.rejects(
      deleteSupabaseStorageObject("unknown-bucket", "../private/object"),
      /object reference is invalid/,
    );
    assert.equal(called, false);
  });
});