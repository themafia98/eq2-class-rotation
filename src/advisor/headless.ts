#!/usr/bin/env node
// Headless advisor: same core pipeline as the overlay, printed to the console. Verifies the
// log -> suggestion pipeline without the game or Electron.
//
//   tsx src/advisor/headless.ts --replay=advisor/sample.log [--role=solo]
//   tsx src/advisor/headless.ts                # live tail (auto-detect)
//   tsx src/advisor/headless.ts --learn        # print unmatched cast-like lines

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startAdvisor } from "./core";
import { loadConfig } from "./config";
import { loadClasses } from "./dataio";
import type { ViewState } from "../shared/types";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");

const args = process.argv.slice(2);
const getOpt = (n: string, d: string | null): string | null => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const has = (f: string): boolean => args.includes(f);

const config = loadConfig(join(ROOT, "assets", "default-config.json"));
const classes = loadClasses(join(ROOT, "data"));
const role = getOpt("role", null) ?? config.defaultRole;
const replayFile = getOpt("replay", null);
const learn = has("--learn");

const fmt = (s: ViewState): string => {
  if (s.error) return `  [!] ${s.error}`;
  const next = s.next ? s.next.name : "(waiting — all on cooldown)";
  const then =
    s.queue.map((q) => (q.ready ? `${q.name}(rdy)` : `${q.name}(${q.remaining}s)`)).join("  ") || "-";
  const refresh = s.refresh.map((r) => r.name).join(", ") || "-";
  const who = s.character ? `${s.character}/${s.class}` : s.class ?? "?";
  return `  [${who} ${s.role}${s.inCombat ? "*" : " "}] NEXT: ${next}\n        then: ${then}\n        REFRESH: ${refresh}`;
};

console.log(
  learn
    ? "LEARN mode — cast-like lines your patterns did NOT match:\n"
    : `Advisor (headless) — role=${role} mode=${replayFile ? "replay" : "live"}\n`
);

const adv = startAdvisor({
  config,
  classes,
  role,
  mode: replayFile ? "replay" : "live",
  file: replayFile ? resolve(ROOT, replayFile) : undefined,
  onState: learn ? undefined : (s) => console.log(fmt(s) + "\n"),
  onLearn: learn ? (line) => console.log("  UNMATCHED:", line) : undefined,
  onActiveClass: (cd, ch) => console.log(`  >> detected: ${ch ?? "?"} / ${cd.class}\n`),
  onEnd: () => {
    console.log("-- end of replay --");
    process.exit(0);
  },
});

if (!learn && adv.logFile) console.log(`(log: ${adv.logFile})\n`);
process.on("SIGINT", () => {
  adv.stop();
  process.exit(0);
});
