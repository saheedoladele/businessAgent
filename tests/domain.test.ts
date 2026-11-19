import { test } from "node:test";
import assert from "node:assert/strict";
import { isDirectoryDomain, normalizeDomain } from "../src/lib/domain";

test("normalizes URLs to bare domains", () => {
  assert.equal(normalizeDomain("https://www.Acme.co.uk/about?x=1"), "acme.co.uk");
  assert.equal(normalizeDomain("acme.com"), "acme.com");
  assert.equal(normalizeDomain("http://shop.acme.com:8080/"), "shop.acme.com");
  assert.equal(normalizeDomain("jane@acme.io"), "acme.io");
});

test("rejects unusable input", () => {
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain(null), null);
  assert.equal(normalizeDomain("localhost"), null);
});

test("flags directory and social sites", () => {
  assert.equal(isDirectoryDomain("linkedin.com"), true);
  assert.equal(isDirectoryDomain("uk.linkedin.com"), true);
  assert.equal(isDirectoryDomain("acme.com"), false);
  assert.equal(isDirectoryDomain("notlinkedin.com"), false);
});
