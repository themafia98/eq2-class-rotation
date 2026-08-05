import { test } from "node:test";
import assert from "node:assert/strict";
import { computeState } from "./engine.mjs";

const classData = {
  class: "Test",
  roles: [
    {
      id: "dps",
      label: "DPS",
      opener: [{ name: "Pull" }],
      priority: [{ name: "A", recast: 10 }, { name: "B", recast: 5 }, { name: "C" }],
      maintain: [{ name: "Buff", duration: 30 }, { name: "Debuff", duration: 20 }],
    },
  ],
};

test("idle (no events) -> opener shown, everything ready, all maintain need refresh", () => {
  const s = computeState(classData, "dps", [], 1000);
  assert.equal(s.inCombat, false);
  assert.equal(s.activeList, "opener");
  assert.equal(s.next.name, "Pull");
  assert.equal(s.queue.length, 3);
  assert.ok(s.queue.every((q) => q.ready));
  assert.equal(s.refresh.length, 2);
});

test("in combat -> next skips abilities on cooldown; queue shows remaining; refresh tracks duration", () => {
  const events = [
    { kind: "cast", name: "A", ts: 995 },
    { kind: "cast", name: "Buff", ts: 980 },
    { kind: "cast", name: "B", ts: 998 },
  ];
  const s = computeState(classData, "dps", events, 1000);

  assert.equal(s.inCombat, true);
  assert.equal(s.activeList, "priority");
  // A (5s left) and B (3s left) on cooldown, C never cast -> C is next
  assert.equal(s.next.name, "C");

  // queue keeps priority order, excludes the chosen next (C)
  assert.deepEqual(
    s.queue.map((q) => [q.name, q.remaining, q.ready]),
    [
      ["A", 5, false],
      ["B", 3, false],
    ]
  );

  // Buff cast at 980, duration 30 -> up until 1010, not due yet.
  // Debuff never cast -> due now.
  assert.deepEqual(
    s.refresh.map((r) => r.name),
    ["Debuff"]
  );
});

test("unknown role returns an error, not a crash", () => {
  const s = computeState(classData, "nope", [], 1000);
  assert.match(s.error, /unknown role/);
});
