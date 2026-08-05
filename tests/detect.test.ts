import { test } from "node:test";
import assert from "node:assert/strict";
import { characterFromLogPath, detectClass } from "../src/advisor/detect";
import type { CastEvent, ClassData } from "../src/shared/types";

test("character from log filename", () => {
  assert.equal(characterFromLogPath("C:/x/logs/Wuoshi/eq2log_Pawlith.txt"), "Pawlith");
  assert.equal(characterFromLogPath("eq2log_Pawlito.2026.08.05.txt"), "Pawlito");
  assert.equal(characterFromLogPath(null), null);
});

function mkClass(name: string, priority: string[]): ClassData {
  return {
    class: name,
    roles: [
      {
        id: "dps",
        label: "DPS",
        maintain: [],
        opener: [],
        priority: priority.map((n) => ({ name: n })),
        emergency: [],
        cooldowns: [],
      },
    ],
  };
}

const ev = (name: string, ts: number): CastEvent => ({ kind: "cast", name, ts, raw: "" });

test("detectClass picks the best ability overlap", () => {
  const inq = mkClass("Inquisitor", ["Invocation", "Torment", "Cleanse"]);
  const wiz = mkClass("Wizard", ["Ice Comet", "Fireball"]);
  assert.equal(detectClass([inq, wiz], [ev("Invocation", 1), ev("Torment", 2)])?.class, "Inquisitor");
});

test("detectClass returns null when nothing matches", () => {
  const inq = mkClass("Inquisitor", ["Invocation"]);
  assert.equal(detectClass([inq], [ev("Nothing", 1)]), null);
});
