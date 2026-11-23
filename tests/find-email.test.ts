import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptFoundEmail, isFreeMail } from "../src/lib/found-email";
import { pickHunterEmail } from "../src/lib/hunter";

test("accepts a found email only when it can be proven", () => {
  // Seen on the source page: accepted, even Gmail
  assert.equal(acceptFoundEmail("acmeltd@gmail.com", "acme.ng", ["acmeltd@gmail.com"]), true);
  // Page loaded but the email isn't on it: likely invented
  assert.equal(acceptFoundEmail("info@acme.ng", "acme.ng", ["sales@acme.ng"]), false);
  // Page unreachable (e.g. Facebook): only the company's own domain is trusted
  assert.equal(acceptFoundEmail("info@acme.ng", "acme.ng", null), true);
  assert.equal(acceptFoundEmail("acmeltd@gmail.com", "acme.ng", null), false);
  assert.equal(acceptFoundEmail("info@other.com", "acme.ng", null), false);
});

test("recognises free-mail providers", () => {
  assert.equal(isFreeMail("x@gmail.com"), true);
  assert.equal(isFreeMail("x@yahoo.co.uk"), true);
  assert.equal(isFreeMail("x@acme.ng"), false);
});

test("prefers a confident decision maker from Hunter", () => {
  const best = pickHunterEmail([
    { value: "info@acme.ng", type: "generic", confidence: 95 },
    { value: "ada@acme.ng", type: "personal", confidence: 88, position: "Managing Director" },
    { value: "bola@acme.ng", type: "personal", confidence: 90, position: "Accountant" },
    { value: "ceo@acme.ng", type: "personal", confidence: 40, position: "CEO" }, // too uncertain
    { value: "old@acme.ng", type: "personal", confidence: 99, position: "Founder", verification: { status: "invalid" } },
  ]);
  assert.equal(best?.value, "ada@acme.ng");
  assert.equal(pickHunterEmail([{ value: "x@acme.ng", confidence: 20 }]), null);
});
