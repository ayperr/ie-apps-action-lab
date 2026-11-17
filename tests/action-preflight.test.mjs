import test from "node:test";
import assert from "node:assert/strict";
import { createPreflightService } from "../server-lib/action-preflight.mjs";
const requestId = "983a14ba-4850-4d3b-87d0-d5aa8771f7cc";
const access = "classroom-test-access-phrase-12345";
const env = {
  LAB_PREFLIGHT_ENABLED: "true", LAB_ACCESS_KEY: access,
  TRELLO_API_KEY: "a".repeat(32), TRELLO_TOKEN: "b".repeat(64), TRELLO_LIST_ID: "c".repeat(24),
  RESEND_API_KEY: `re_${"a".repeat(32)}`, LAB_EMAIL_TO: "teacher@example.org",
};
const input = { action: "trello", requestId, confirmed: true };

test("panel disables writes by default and never publishes credentials or recipient", async () => {
  const service = createPreflightService({ env: { ...env, LAB_PREFLIGHT_ENABLED: "false" } });
  assert.equal((await service.submit(input, `Bearer ${access}`)).status, 503);
  const status = JSON.stringify(service.status());
  for (const value of [access, env.TRELLO_API_KEY, env.TRELLO_TOKEN, env.RESEND_API_KEY, env.LAB_EMAIL_TO]) assert.equal(status.includes(value), false);
});

test("authentication, confirmation and destination restrictions precede any provider call", async () => {
  let calls = 0;
  const service = createPreflightService({ env, transports: { createTrelloCard: async () => { calls++; } } });
  assert.equal((await service.submit(input, "Bearer incorrect")).status, 401);
  assert.equal((await service.submit({ ...input, confirmed: false }, `Bearer ${access}`)).status, 400);
  assert.equal((await service.submit({ ...input, listId: "attacker" }, `Bearer ${access}`)).status, 400);
  assert.equal((await service.submit({ ...input, action: "arbitrary" }, `Bearer ${access}`)).status, 400);
  assert.equal(calls, 0);
  assert.equal(service.status("Bearer incorrect").authenticated, false);
  assert.equal(service.status(`Bearer ${access}`).authenticated, true);
  assert.equal(service.status(`Bearer ${access}`).providers.email.destination, env.LAB_EMAIL_TO);
});

test("concurrent identical requests perform one write and require separate exact read-back", async () => {
  let writes = 0; let reads = 0;
  const service = createPreflightService({ env, transports: {
    createTrelloCard: async (config, action) => {
      writes++; assert.equal(config.listId, env.TRELLO_LIST_ID); assert.equal(action.recordId, "NS-1041");
      return { state: "created", cardId: "d".repeat(24), cardUrl: "https://trello.com/c/abc123" };
    },
    verifyTrelloCard: async () => { reads++; return { state: "verified", matched: { id: true, title: true, body: true, list: true } }; },
  } });
  const results = await Promise.all([service.submit(input, `Bearer ${access}`), service.submit(input, `Bearer ${access}`)]);
  assert.equal(writes, 1); assert.equal(reads, 1); assert.equal(results[0].body.state, "verified");
  assert.deepEqual(results[0].body, results[1].body);
});

test("failed read-back never turns a created card into verified success", async () => {
  const service = createPreflightService({ env, transports: {
    createTrelloCard: async () => ({ state: "created", cardId: "d".repeat(24), cardUrl: "https://trello.com/c/abc123" }),
    verifyTrelloCard: async () => ({ state: "mismatch" }),
  } });
  const result = await service.submit(input, `Bearer ${access}`);
  assert.equal(result.body.state, "unknown"); assert.equal(result.body.url, "https://trello.com/c/abc123");
});

test("email provider delivery remains distinct from inbox verification", async () => {
  const service = createPreflightService({ env, transports: {
    createResendEmail: async () => ({ state: "accepted", emailId: requestId }),
    verifyResendEmail: async () => ({ state: "matched", deliveryState: "delivered", matched: { id: true } }),
  } });
  const result = await service.submit({ ...input, action: "email" }, `Bearer ${access}`);
  assert.equal(result.body.state, "accepted"); assert.equal(result.body.deliveryState, "delivered"); assert.equal(result.body.inboxVerified, false);
});
