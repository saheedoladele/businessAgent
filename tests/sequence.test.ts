import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSequenceAction } from "../src/lib/sequence-rules";
import { isWithinSendWindow } from "../src/lib/send-window";

const now = new Date("2026-11-19T10:00:00Z");
const past = new Date("2026-11-18T10:00:00Z");
const future = new Date("2026-11-20T10:00:00Z");
const days = [3, 7, 14]; // 3 follow-ups after the first email

test("waits until the next action is due", () => {
  assert.equal(nextSequenceAction({ status: "CONTACTED", sequenceStep: 1, nextActionAt: future }, days, now), "wait");
  assert.equal(nextSequenceAction({ status: "CONTACTED", sequenceStep: 1, nextActionAt: null }, days, now), "wait");
});

test("sends follow-ups while steps remain", () => {
  assert.equal(nextSequenceAction({ status: "CONTACTED", sequenceStep: 1, nextActionAt: past }, days, now), "follow-up");
  assert.equal(nextSequenceAction({ status: "CONTACTED", sequenceStep: 3, nextActionAt: past }, days, now), "follow-up");
});

test("finishes after the last follow-up", () => {
  assert.equal(nextSequenceAction({ status: "CONTACTED", sequenceStep: 4, nextActionAt: past }, days, now), "finish");
});

test("never acts on leads that replied, declined or opted out", () => {
  for (const status of ["REPLIED", "NOT_INTERESTED", "UNSUBSCRIBED", "MEETING_SCHEDULED"]) {
    assert.equal(nextSequenceAction({ status, sequenceStep: 1, nextActionAt: past }, days, now), "wait");
  }
});

test("nudges interested leads to book, then hands over to you", () => {
  const lead = { status: "INTERESTED", sequenceStep: 1, nextActionAt: past };
  assert.equal(nextSequenceAction(lead, days, now, 0), "nudge");
  assert.equal(nextSequenceAction(lead, days, now, 1), "nudge");
  assert.equal(nextSequenceAction(lead, days, now, 2), "stop-nudging");
  assert.equal(nextSequenceAction({ ...lead, nextActionAt: future }, days, now, 0), "wait");
});

test("send window respects timezone and weekends", () => {
  // Thu 19 Nov 2026 07:30 UTC = 08:30 in Lagos (UTC+1)
  const thuMorning = new Date("2026-11-19T07:30:00Z");
  assert.equal(isWithinSendWindow(thuMorning, "08:00-17:30", "Africa/Lagos"), true);
  assert.equal(isWithinSendWindow(thuMorning, "08:00-17:30", "UTC"), false);
  // Sat 21 Nov 2026 midday
  const saturday = new Date("2026-11-21T12:00:00Z");
  assert.equal(isWithinSendWindow(saturday, "08:00-17:30", "UTC"), false);
  assert.equal(isWithinSendWindow(saturday, "08:00-17:30", "UTC", false), true);
});
