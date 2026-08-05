import { test } from "node:test";
import assert from "node:assert/strict";
import { createParser, stripTimestamp, looksLikeCast } from "../src/advisor/parse";

const parse = createParser();

test("stripTimestamp pulls epoch + text", () => {
  const { ts, text } = stripTimestamp(
    "(1650017527)[Fri Apr 15 12:12:07 2022] YOUR Verdict hits a wooly spider for 260 divine damage."
  );
  assert.equal(ts, 1650017527);
  assert.equal(text, "YOUR Verdict hits a wooly spider for 260 divine damage.");
});

test("effect line: single-word ability", () => {
  const ev = parse("(1785949908)[Wed Aug  5 19:11:48 2026] YOUR Invocation hits a wooly spider for 260 divine damage.");
  assert.deepEqual({ ts: ev?.ts, name: ev?.name }, { ts: 1785949908, name: "Invocation" });
});

test("effect line: multi-word ability + heal verb", () => {
  assert.equal(parse("(1)[..] YOUR Convert Ally heals Daje for 23 hit points.")?.name, "Convert Ally");
});

test("effect line: 'reduces' verb (detaunt)", () => {
  assert.equal(parse("(1)[..] YOUR Serenade reduces YOUR hate with a razorfeather for 153 threat.")?.name, "Serenade");
});

test("title-case 'Your' loot/status is NOT a cast", () => {
  assert.equal(parse("(1)[..] Your share of 13 Silver from the corpse is 4 Silver."), null);
  assert.equal(parse("(2)[..] Your strength fades."), null);
});

test("still supports explicit begin-casting patterns", () => {
  assert.equal(parse("(3)[..] You begin casting Malevolent Diatribe.")?.name, "Malevolent Diatribe");
});

test("non-ability line -> null", () => {
  assert.equal(parse("(4)[..] A wooly spider hits YOU for 42 points of damage."), null);
});

test("looksLikeCast flags YOUR + begin-cast lines", () => {
  assert.equal(looksLikeCast("YOUR Weirdverb frobnicates a spider."), true);
  assert.equal(looksLikeCast("You begin casting Foo!"), true);
  assert.equal(looksLikeCast("A goblin hits YOU."), false);
});
