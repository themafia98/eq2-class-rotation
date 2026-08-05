#!/usr/bin/env node
// Headless advisor: runs the same core pipeline as the Electron overlay but
// prints state to the console. Used to verify the log -> suggestion pipeline
// without the game or Electron.
//
//   node advisor/headless.mjs --replay=advisor/sample.log [--role=raiddps]
//   node advisor/headless.mjs                  # live tail (auto-detect log)
//   node advisor/headless.mjs --learn          # print unmatched cast lines

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startAdvisor, loadClassData } from "./core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const getOpt = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const has = (f) => args.includes(f);

const config = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf8"));
const dataFile = resolve(ROOT, getOpt("class-file", config.dataFile));
const classData = loadClassData(dataFile);
const role = getOpt("role", config.defaultRole);
const replayFile = getOpt("replay", null);
const learn = has("--learn");

const fmt = (s) => {
  if (s.error) return `  [!] ${s.error}`;
  const next = s.next ? s.next.name : "(waiting — all on cooldown)";
  const then =
    s.queue.map((q) => (q.ready ? `${q.name}(rdy)` : `${q.name}(${q.remaining}s)`)).join("  ") || "-";
  const refresh = s.refresh.map((r) => r.name).join(", ") || "-";
  const flag = s.inCombat ? "*" : " ";
  return `  [${s.role}${flag}] NEXT: ${next}\n        then: ${then}\n        REFRESH: ${refresh}`;
};

if (learn) {
  console.log("LEARN mode — cast-like lines your patterns did NOT match (adjust castPatterns):\n");
} else {
  console.log(`Advisor (headless) — class=${classData.class} role=${role} mode=${replayFile ? "replay" : "live"}\n`);
}

const adv = startAdvisor({
  config,
  classData,
  role,
  mode: replayFile ? "replay" : "live",
  file: replayFile ? resolve(ROOT, replayFile) : undefined,
  onState: learn ? undefined : (s) => console.log(fmt(s) + "\n"),
  onLearn: learn ? (line) => console.log("  UNMATCHED:", line) : undefined,
  onEnd: () => {
    console.log("-- end of replay --");
    process.exit(0);
  },
});

if (!learn && adv.logFile) console.log(`(log: ${adv.logFile})\n`);
process.on("SIGINT", () => { adv.stop(); process.exit(0); });
