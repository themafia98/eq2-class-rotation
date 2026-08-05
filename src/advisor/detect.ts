// Character + class auto-detection from the log.

import { basename } from "node:path";
import type { Ability, CastEvent, ClassData, Role } from "../shared/types";

/** Character name from an eq2log_<Char>[.YYYY.MM.DD].txt path. */
export function characterFromLogPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const m = /^eq2log_(.+?)(?:\.\d{4}\.\d{2}\.\d{2})?\.txt$/i.exec(basename(p));
  return m && m[1] ? m[1] : null;
}

function allAbilities(role: Role): Ability[] {
  return [...role.maintain, ...role.opener, ...role.priority, ...role.emergency, ...role.cooldowns];
}

/** Lowercased set of every ability name (and logName) a class knows. */
export function abilityNamesOf(cd: ClassData): Set<string> {
  const s = new Set<string>();
  for (const role of cd.roles) {
    for (const a of allAbilities(role)) {
      s.add(a.name.toLowerCase());
      if (a.logName) s.add(a.logName.toLowerCase());
    }
  }
  return s;
}

/** Pick the class whose ability set best overlaps the recently-seen cast names. */
export function detectClass(classes: ClassData[], recentEvents: CastEvent[]): ClassData | null {
  if (classes.length === 0) return null;
  const seen = new Set(recentEvents.map((e) => e.name.toLowerCase()));
  let best: { cd: ClassData; score: number } | null = null;
  for (const cd of classes) {
    const names = abilityNamesOf(cd);
    let score = 0;
    for (const n of seen) if (names.has(n)) score++;
    if (!best || score > best.score) best = { cd, score };
  }
  return best && best.score > 0 ? best.cd : null;
}
