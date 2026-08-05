import { test } from "node:test";
import assert from "node:assert/strict";
import { computeState } from "../src/advisor/engine";
import type { CastEvent, ClassData } from "../src/shared/types";

const empty = { maintain: [], opener: [], priority: [], emergency: [], cooldowns: [] };
const classData: ClassData = {
  class: "Test",
  roles: [
    {
      id: "dps",
      label: "DPS",
      ...empty,
      opener: [{ name: "Pull" }],
      priority: [{ name: "A", recast: 10 }, { name: "B", recast: 5 }, { name: "C" }],
      maintain: [{ name: "Buff", duration: 30 }, { name: "Debuff", duration: 20 }],
    },
  ],
};

test("idle -> opener shown, everything ready, all maintain need refresh", () => {
  const s = computeState(classData, "dps", [], 1000);
  assert.equal(s.inCombat, false);
  assert.equal(s.activeList, "opener");
  assert.equal(s.next?.name, "Pull");
  assert.equal(s.queue.length, 3);
  assert.ok(s.queue.every((q) => q.ready));
  assert.equal(s.refresh.length, 2);
});

test("in combat -> next skips cooldowns; queue shows remaining; refresh tracks duration", () => {
  const events: CastEvent[] = [
    { kind: "cast", name: "A", ts: 995, raw: "" },
    { kind: "cast", name: "Buff", ts: 980, raw: "" },
    { kind: "cast", name: "B", ts: 998, raw: "" },
  ];
  const s = computeState(classData, "dps", events, 1000);
  assert.equal(s.inCombat, true);
  assert.equal(s.next?.name, "C");
  assert.deepEqual(
    s.queue.map((q) => [q.name, q.remaining, q.ready]),
    [["A", 5, false], ["B", 3, false]]
  );
  assert.deepEqual(s.refresh.map((r) => r.name), ["Debuff"]);
});

test("unknown role returns an error, not a crash", () => {
  assert.match(computeState(classData, "nope", [], 1000).error ?? "", /unknown role/);
});
