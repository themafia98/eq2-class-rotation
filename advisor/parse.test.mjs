import { test } from "node:test";
import assert from "node:assert/strict";
import { createParser, stripTimestamp, looksLikeCast } from "./parse.mjs";

const parse = createParser(); // defaults: begin-casting patterns + YOUR-effect matching

test("stripTimestamp pulls epoch + text", () => {
  const { ts, text } = stripTimestamp(
    "(1650017527)[Fri Apr 15 12:12:07 2022] YOUR Verdict hits a wooly spider for 260 divine damage."
  );
  assert.equal(ts, 1650017527);
  assert.equal(text, "YOUR Verdict hits a wooly spider for 260 divine damage.");
});

test("stripTimestamp without timestamp", () => {
  const { ts, text } = stripTimestamp("YOUR Verdict hits something.");
  assert.equal(ts, null);
  assert.equal(text, "YOUR Verdict hits something.");
});

test("effect line: single-word ability (real EQ2 format)", () => {
  const ev = parse(
    "(1785949908)[Wed Aug  5 19:11:48 2026] YOUR Invocation hits a wooly spider for 260 divine damage."
  );
  assert.deepEqual({ ts: ev.ts, kind: ev.kind, name: ev.name }, {
    ts: 1785949908,
    kind: "cast",
    name: "Invocation",
  });
});

test("effect line: multi-word ability + heal verb", () => {
  const ev = parse("(1785949900)[..] YOUR Convert Ally heals Daje for 23 hit points.");
  assert.equal(ev.name, "Convert Ally");
});

test("effect line: 'reduces' verb (detaunt)", () => {
  const ev = parse("(100)[..] YOUR Serenade reduces YOUR hate with a razorfeather for 153 threat.");
  assert.equal(ev.name, "Serenade");
});

test("title-case 'Your' loot/status is NOT a cast", () => {
  assert.equal(parse("(1)[..] Your share of 13 Silver from the corpse is 4 Silver."), null);
  assert.equal(parse("(2)[..] Your strength fades."), null);
});

test("still supports explicit begin-casting patterns when present", () => {
  const ev = parse("(3)[..] You begin casting Malevolent Diatribe.");
  assert.equal(ev.name, "Malevolent Diatribe");
});

test("non-ability line -> null", () => {
  assert.equal(parse("(4)[..] A wooly spider hits YOU for 42 points of damage."), null);
});

test("fallback timestamp used when line has none", () => {
  const ev = parse("YOUR Cleanse hits a spider for 10 divine damage.", 999);
  assert.equal(ev.ts, 999);
  assert.equal(ev.name, "Cleanse");
});

test("looksLikeCast flags YOUR + begin-cast lines for --learn", () => {
  assert.equal(looksLikeCast("YOUR Weirdverb frobnicates a spider."), true);
  assert.equal(looksLikeCast("You begin casting Foo!"), true);
  assert.equal(looksLikeCast("A goblin hits YOU."), false);
});
