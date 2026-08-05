import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compilePatterns,
  parseLine,
  stripTimestamp,
  looksLikeCast,
  DEFAULT_CAST_PATTERNS,
} from "./parse.mjs";

const compiled = compilePatterns(DEFAULT_CAST_PATTERNS);

test("stripTimestamp pulls epoch + text", () => {
  const { ts, text } = stripTimestamp(
    "(1650017527)[Fri Apr 15 12:12:07 2022] You begin casting Alleviation."
  );
  assert.equal(ts, 1650017527);
  assert.equal(text, "You begin casting Alleviation.");
});

test("stripTimestamp without timestamp", () => {
  const { ts, text } = stripTimestamp("You begin casting Alleviation.");
  assert.equal(ts, null);
  assert.equal(text, "You begin casting Alleviation.");
});

test("parseLine: spell cast", () => {
  const ev = parseLine(
    "(1650017527)[Fri Apr 15 12:12:07 2022] You begin casting Malevolent Diatribe.",
    compiled
  );
  assert.deepEqual({ ts: ev.ts, kind: ev.kind, name: ev.name }, {
    ts: 1650017527,
    kind: "cast",
    name: "Malevolent Diatribe",
  });
});

test("parseLine: combat art (begin to perform)", () => {
  const ev = parseLine(
    "(1650017530)[Fri Apr 15 12:12:10 2022] You begin to perform Verdict.",
    compiled
  );
  assert.equal(ev.name, "Verdict");
});

test("parseLine: non-cast line -> null", () => {
  const ev = parseLine(
    "(1650017531)[Fri Apr 15 12:12:11 2022] A goblin hits YOU for 42 points of damage.",
    compiled
  );
  assert.equal(ev, null);
});

test("parseLine: fallback timestamp used when line has none", () => {
  const ev = parseLine("You begin casting Alleviation.", compiled, 999);
  assert.equal(ev.ts, 999);
  assert.equal(ev.name, "Alleviation");
});

test("looksLikeCast flags unmatched cast lines for --learn", () => {
  assert.equal(looksLikeCast("You begin casting Foo!"), true);
  assert.equal(looksLikeCast("You begin to perform Bar!"), true);
  assert.equal(looksLikeCast("A goblin hits YOU."), false);
});
