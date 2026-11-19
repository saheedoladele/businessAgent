import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJSON } from "../src/lib/ai";

test("parses plain JSON", () => {
  assert.deepEqual(extractJSON('{"a":1}'), { a: 1 });
});

test("parses fenced JSON", () => {
  assert.deepEqual(extractJSON('Here you go:\n```json\n[{"a":1}]\n```'), [{ a: 1 }]);
});

test("parses JSON surrounded by prose", () => {
  assert.deepEqual(extractJSON('Sure! {"leads":[]} Hope that helps.'), { leads: [] });
});

test("throws when there is no JSON", () => {
  assert.throws(() => extractJSON("no json here"));
});
