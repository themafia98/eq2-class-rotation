import { test } from "node:test";
import assert from "node:assert/strict";
import { createIngestor } from "../src/advisor/ingest";
import type { CastEvent } from "../src/shared/types";

const ev = (name: string, ts: number): CastEvent => ({ kind: "cast", name, ts, raw: "" });

test("DoT ticks collapse within the reuse window; a real recast is accepted", () => {
  const recastOf = (n: string): number => (n === "Torment" ? 10 : 1);
  const ing = createIngestor(recastOf, 100);
  const accepted: number[] = [];
  for (const t of [0, 2, 4, 6, 8, 10, 12]) if (ing.push(ev("Torment", t))) accepted.push(t);
  assert.deepEqual(accepted, [0, 10]); // one cast per reuse window, not per tick
  assert.equal(ing.events.length, 2);
});

test("sub-second multi-hit lines collapse for a no-recast ability", () => {
  const ing = createIngestor(() => 1, 100);
  const accepted: number[] = [];
  for (const t of [100, 100, 101, 102]) if (ing.push(ev("Cleave", t))) accepted.push(t);
  assert.deepEqual(accepted, [100, 101, 102]);
  assert.ok(ing.seen.has("cleave"));
});

test("cap drops the oldest events", () => {
  const ing = createIngestor(() => 0, 3);
  for (const t of [1, 2, 3, 4, 5]) ing.push(ev("X" + t, t));
  assert.equal(ing.events.length, 3);
  assert.equal(ing.events[0]?.name, "X3");
});
