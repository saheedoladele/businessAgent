import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBusinessForm } from "../src/lib/business-input";

function form(overrides: Record<string, string> = {}) {
  const f = new FormData();
  const base: Record<string, string> = {
    name: "SaheedTech Studio",
    description: "We build custom web apps and dashboards for SMBs.",
    services: "Web apps\nDashboards",
    website: "saheedtech.com",
    idealCustomer: "Logistics and retail SMBs in Lagos still running on spreadsheets.",
    targetLocations: "",
    bookingUrl: "https://cal.com/saheed/intro",
    senderName: "Saheed",
    senderEmail: "Saheed@SaheedTech.com",
    physicalAddress: "",
    dailySendLimit: "30",
    minFitScore: "60",
    followUpDays: "3, 7, 14",
    requireApproval: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

test("parses a valid form and normalises values", () => {
  const r = parseBusinessForm(form());
  assert.ok("data" in r);
  assert.equal(r.data.website, "https://saheedtech.com");
  assert.equal(r.data.senderEmail, "saheed@saheedtech.com");
  assert.deepEqual(r.data.followUpDays, [3, 7, 14]);
  assert.equal(r.data.requireApproval, true);
  assert.equal(r.data.autoDiscover, false);
  assert.equal(r.data.targetLocations, null);
});

test("returns a readable error for bad input", () => {
  const r = parseBusinessForm(form({ senderEmail: "not-an-email" }));
  assert.ok("error" in r && /senderEmail/.test(r.error));
  const r2 = parseBusinessForm(form({ followUpDays: "3, 0" }));
  assert.ok("error" in r2 && /followUpDays/.test(r2.error));
});
