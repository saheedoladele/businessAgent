import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CALL_ATTEMPTS, planAfterCall } from "../src/lib/call-rules";
import { toE164, whatsappLink } from "../src/lib/phone";

test("normalises phone numbers to E.164", () => {
  assert.equal(toE164("0803 123 4567", "234"), "+2348031234567");
  assert.equal(toE164("+234 (803) 123-4567", "234"), "+2348031234567");
  assert.equal(toE164("00447946095800", "234"), "+447946095800");
  assert.equal(toE164("07946 095800", "44"), "+447946095800");
  assert.equal(toE164("123", "234"), null);
});

test("builds WhatsApp links with the message prefilled", () => {
  assert.equal(whatsappLink("+2348031234567", "Hi Ada!"), "https://wa.me/2348031234567?text=Hi%20Ada!");
});

test("call outcomes move the lead on", () => {
  assert.deepEqual(planAfterCall("BOOKED", 0), { taskStatus: "DONE", leadStatus: "MEETING_SCHEDULED" });
  assert.deepEqual(planAfterCall("CALLBACK", 0), { taskStatus: "OPEN", retryInDays: 2 });
  assert.deepEqual(planAfterCall("WRONG_NUMBER", 0), { taskStatus: "DONE", leadStatus: "DISQUALIFIED" });
});

test("no answer retries, then gives up", () => {
  assert.deepEqual(planAfterCall("NO_ANSWER", 0), { taskStatus: "OPEN", retryInDays: 1 });
  assert.deepEqual(planAfterCall("NO_ANSWER", MAX_CALL_ATTEMPTS - 1), { taskStatus: "SKIPPED", leadStatus: "NO_RESPONSE" });
});
