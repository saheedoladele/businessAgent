import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEmails, extractPhones, findContactLinks, htmlToText, pickBestEmail } from "../src/lib/scrape";

const html = `<html><head><style>.x{}</style><script>var a="bad@sentry.io"</script></head><body>
  <nav><a href="/about-us">About</a> <a href="https://acme.com/contact">Contact us</a>
  <a href="https://twitter.com/acme">Twitter</a> <a href="/blog/post">Blog</a></nav>
  <p>Email: <a href="mailto:Sales@Acme.com">Sales@Acme.com</a> or jane&#64;acme.com.</p>
  <img src="logo@2x.png"> <a href="tel:+234 801 234 5678">Call</a> Office: +44 20 7946 0958
</body></html>`;

test("extracts emails, skipping junk", () => {
  const emails = extractEmails(html).sort();
  assert.deepEqual(emails, ["jane@acme.com", "sales@acme.com"]);
});

test("extracts phones from tel: links and text", () => {
  assert.deepEqual(extractPhones(html).sort(), ["+2348012345678", "+442079460958"]);
});

test("finds contact/about links on the same site, contact first", () => {
  assert.deepEqual(findContactLinks(html, "https://www.acme.com/"), [
    "https://acme.com/contact",
    "https://www.acme.com/about-us",
  ]);
});

test("htmlToText drops scripts and tags", () => {
  const t = htmlToText(html);
  assert.ok(!t.includes("sentry"));
  assert.ok(t.includes("Contact us"));
});

test("pickBestEmail prefers the named contact, then a person, then sales/info", () => {
  const list = ["support@acme.com", "info@acme.com", "tunde@acme.com", "jane@acme.com", "x@gmail.com"];
  assert.equal(pickBestEmail(list, "acme.com", "Jane Doe"), "jane@acme.com");
  assert.equal(pickBestEmail(["support@acme.com", "info@acme.com"], "acme.com"), "info@acme.com");
  assert.equal(pickBestEmail(["owner@gmail.com"], "acme.com"), "owner@gmail.com");
  assert.equal(pickBestEmail([], "acme.com"), null);
});
