import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFooter, createUnsubscribeToken, verifyUnsubscribeToken } from "../src/lib/unsubscribe";
import { isHardBounce } from "../src/lib/mailer";

const KEY = "test-secret-at-least-16-chars";

test("unsubscribe token round-trips", () => {
  const t = createUnsubscribeToken("lead_123", KEY);
  assert.equal(verifyUnsubscribeToken(t, KEY), "lead_123");
});

test("rejects tampered or foreign tokens", () => {
  const t = createUnsubscribeToken("lead_123", KEY);
  assert.equal(verifyUnsubscribeToken(t.replace("lead_123", "lead_999"), KEY), null);
  assert.equal(verifyUnsubscribeToken(t, "another-secret-16chars"), null);
  assert.equal(verifyUnsubscribeToken("garbage", KEY), null);
});

test("footer has address and opt-out", () => {
  const f = buildFooter({ businessName: "Acme", physicalAddress: "1 Road, Lagos", unsubscribeUrl: "https://x/u" });
  assert.match(f, /Acme, 1 Road, Lagos/);
  assert.match(f, /unsubscribe: https:\/\/x\/u/);
});

test("detects hard bounces", () => {
  assert.equal(isHardBounce({ responseCode: 550, response: "550 5.1.1 User unknown" }), true);
  assert.equal(isHardBounce({ responseCode: 421, response: "421 Try again later" }), false);
});
