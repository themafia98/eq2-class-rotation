// Typed config loading. User config is deep-merged over built-in defaults, so a partial or stale
// config (e.g. one missing effectVerbs) still gets working values — defence in depth beyond the
// on-upgrade re-seed.

import { readFileSync } from "node:fs";
import type { AdvisorConfig } from "../shared/types";
import { DEFAULT_CAST_PATTERNS, DEFAULT_EFFECT_VERBS } from "./parse";
import { DEFAULT_ENGINE } from "./engine";

export const DEFAULT_CONFIG: AdvisorConfig = {
  class: "Inquisitor",
  dataFile: "data/inquisitor.json",
  logsDir: "auto",
  logFile: "auto",
  defaultRole: "raiddps",
  autoDetectClass: true,
  castPatterns: DEFAULT_CAST_PATTERNS,
  effectPrefix: "YOUR",
  effectVerbs: DEFAULT_EFFECT_VERBS,
  engine: DEFAULT_ENGINE,
  eventCap: 400,
  replayIntervalMs: 350,
  tickMs: 250,
  logRescanMs: 5000,
  window: { opacity: 0.92, corner: "top-right", width: 300, height: 260, margin: 24 },
  shortcuts: {
    roleHeal: "Control+Alt+H",
    roleSolo: "Control+Alt+S",
    roleGrpDps: "Control+Alt+D",
    roleRaid: "Control+Alt+R",
    toggleClickThrough: "Control+Alt+O",
    toggleShow: "Control+Alt+G",
    toggleEditor: "Control+Alt+P",
    opacityUp: "Control+Alt+Up",
    opacityDown: "Control+Alt+Down",
    openSettings: "Control+Alt+E",
  },
};

function nonEmpty<T>(v: T[] | undefined, fallback: T[]): T[] {
  return v && v.length ? v : fallback;
}

export function mergeConfig(base: AdvisorConfig, user: Partial<AdvisorConfig>): AdvisorConfig {
  return {
    ...base,
    ...user,
    engine: { ...base.engine, ...(user.engine ?? {}) },
    window: { ...base.window, ...(user.window ?? {}) },
    shortcuts: { ...base.shortcuts, ...(user.shortcuts ?? {}) },
    castPatterns: nonEmpty(user.castPatterns, base.castPatterns),
    effectVerbs: nonEmpty(user.effectVerbs, base.effectVerbs),
  };
}

export function loadConfig(file: string): AdvisorConfig {
  let user: Partial<AdvisorConfig> = {};
  try {
    user = JSON.parse(readFileSync(file, "utf8")) as Partial<AdvisorConfig>;
  } catch {
    /* fall back to defaults */
  }
  return mergeConfig(DEFAULT_CONFIG, user);
}
