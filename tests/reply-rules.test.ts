import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bouncedRecipients,
  isAutoReply,
  isBounce,
  matchLeadId,
  quickClassify,
  stripQuoted,
  type InboundEmail,
} from "../src/lib/reply-rules";

const base: InboundEmail = {
  messageId: "<in-1@acme.com>",
  inReplyTo: null,
  references: [],
  fromEmail: "ada@acme.com",
  subject: "Re: quick question",
  text: "Sounds good, let's talk.",
  headers: {},
};

test("strips quoted history from Gmail and Outlook replies", () => {
  const gmail = "Yes please, send times.\n\nOn Thu, 19 Nov 2026 at 10:00, Saheed <s@x.com> wrote:\n> Hi Ada,\n> ...";
  assert.equal(stripQuoted(gmail), "Yes please, send times.");
  const outlook = "Not now, thanks.\n\n-----Original Message-----\nFrom: Saheed\nSent: ...";
  assert.equal(stripQuoted(outlook), "Not now, thanks.");
});

test("detects auto-replies and bounces", () => {
  assert.equal(isAutoReply({ ...base, headers: { "auto-submitted": "auto-replied" } }), true);
  assert.equal(isAutoReply({ ...base, subject: "Out of Office: back Monday" }), true);
  assert.equal(isAutoReply(base), false);
  assert.equal(isBounce({ ...base, fromEmail: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification (Failure)" }), true);
  assert.equal(isBounce(base), false);
});

test("quick-classifies obvious replies without AI", () => {
  assert.equal(quickClassify({ ...base, text: "STOP" }), "UNSUBSCRIBE");
  assert.equal(quickClassify({ ...base, text: "Please remove me.\n\nOn Mon, X wrote:\n> hi" }), "UNSUBSCRIBE");
  assert.equal(quickClassify({ ...base, subject: "Automatic reply: Re: hello" }), "OUT_OF_OFFICE");
  assert.equal(quickClassify(base), null); // needs Claude
});

test("matches replies to leads by thread first, then by sender", () => {
  const sent = new Map([["<out-1@studio.com>", "lead_A"]]);
  const byEmail = new Map([["ada@acme.com", "lead_B"]]);
  assert.equal(matchLeadId({ ...base, inReplyTo: "<out-1@studio.com>" }, sent, byEmail), "lead_A");
  assert.equal(matchLeadId({ ...base, references: ["<x@y>", "<out-1@studio.com>"] }, sent, byEmail), "lead_A");
  assert.equal(matchLeadId(base, sent, byEmail), "lead_B");
  assert.equal(matchLeadId({ ...base, fromEmail: "stranger@z.com" }, sent, byEmail), null);
});

test("matches bounces to the lead whose address failed", () => {
  const bounce: InboundEmail = {
    ...base,
    fromEmail: "mailer-daemon@googlemail.com",
    subject: "Delivery Status Notification (Failure)",
    text: "Your message to tunde@shop.ng couldn't be delivered.\nFinal-Recipient: rfc822; tunde@shop.ng\nFrom: saheed@studio.com",
  };
  assert.deepEqual(bouncedRecipients(bounce).slice(0, 1), ["tunde@shop.ng"]);
  assert.equal(matchLeadId(bounce, new Map(), new Map([["tunde@shop.ng", "lead_T"]])), "lead_T");
});
