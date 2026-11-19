import { test } from "node:test";
import assert from "node:assert/strict";
import { lintEmail } from "../src/lib/email-lint";

const good = `Hi Ada,

Noticed Swift Logistics is hiring two dispatch coordinators, and your booking form still sends requests to email.

We build simple dispatch dashboards that cut that back-and-forth. Would it be useful if I sketched what that could look like for you?

Saheed`;

test("accepts a clean email", () => {
  assert.deepEqual(lintEmail(good), []);
});

test("flags placeholders, spam words, generic openers and emoji", () => {
  assert.match(lintEmail("Hi [First Name], quick one.").join(), /placeholder/);
  assert.match(lintEmail("Get a free audit today").join(), /spam/);
  assert.match(lintEmail("I hope this email finds you well.").join(), /generic opener/);
  assert.match(lintEmail("Quick idea 🚀 for you").join(), /emoji/);
});

test("flags emails that are too long", () => {
  assert.match(lintEmail("word ".repeat(200), 100).join(), /too long/);
});
