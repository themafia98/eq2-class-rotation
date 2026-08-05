// DoT-aware event ingestion. An ability's effect line lands on every tick / multi-hit; we collapse
// lines that arrive within the ability's reuse window into a single "cast", so DoTs don't read as
// "on cooldown forever" and multi-hit abilities don't spam the timeline.

import type { CastEvent } from "../shared/types";

export interface Ingestor {
  readonly events: CastEvent[];
  readonly seen: Set<string>;
  /** returns true if accepted as a new cast, false if collapsed as a tick/duplicate */
  push(ev: CastEvent): boolean;
}

export function createIngestor(recastOf: (name: string) => number, cap: number): Ingestor {
  const events: CastEvent[] = [];
  const seen = new Set<string>();
  const lastAccepted = new Map<string, number>();
  return {
    events,
    seen,
    push(ev: CastEvent): boolean {
      const key = ev.name.toLowerCase();
      seen.add(key);
      const prev = lastAccepted.get(key);
      // Anchor to the accepted cast (do NOT advance on ticks), so a real recast after the reuse
      // window is still detected while intervening ticks are ignored.
      if (prev !== undefined && ev.ts - prev < recastOf(ev.name)) return false;
      lastAccepted.set(key, ev.ts);
      events.push(ev);
      if (events.length > cap) events.shift();
      return true;
    },
  };
}
