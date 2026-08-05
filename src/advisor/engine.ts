// Pure rotation engine. No I/O. Given the class data, active role, cast events, and the current
// time, decide what to suggest. Cooldowns are ESTIMATED from when you cast (per the log) plus each
// ability's `recast` — guidance, not ground truth (EQ2 exposes no cooldown data to any log reader).

import type {
  Ability,
  CastEvent,
  ClassData,
  EngineOpts,
  QueueItem,
  RefreshItem,
  Role,
  ViewState,
} from "../shared/types";

export const DEFAULT_ENGINE: EngineOpts = { gcd: 1, combatWindow: 8, queueSize: 3, refreshLead: 0 };

const norm = (s: string): string => s.trim().toLowerCase();

function logNamesOf(a: Ability): string[] {
  const names = [a.name];
  if (a.logName) names.push(a.logName);
  return names.map(norm);
}

export function lastCastMap(events: CastEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== "cast") continue;
    const key = norm(e.name);
    const ts = e.ts ?? 0;
    const prev = m.get(key);
    if (prev === undefined || ts > prev) m.set(key, ts);
  }
  return m;
}

function lastCastOf(a: Ability, lastMap: Map<string, number>): number {
  let best = -Infinity;
  for (const n of logNamesOf(a)) {
    const v = lastMap.get(n);
    if (v !== undefined) best = Math.max(best, v);
  }
  return best;
}

function remainingCd(a: Ability, lastMap: Map<string, number>, now: number, gcd: number): number {
  const last = lastCastOf(a, lastMap);
  if (last === -Infinity) return 0;
  return Math.max(0, last + (a.recast ?? gcd) - now);
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function computeState(
  classData: ClassData,
  roleId: string,
  events: CastEvent[],
  now: number,
  opts: Partial<EngineOpts> = {}
): ViewState {
  const o: EngineOpts = { ...DEFAULT_ENGINE, ...opts };
  const role: Role | undefined = (classData.roles || []).find((r) => r.id === roleId);
  if (!role) {
    return { error: `unknown role: ${roleId}`, role: roleId, next: null, queue: [], refresh: [] };
  }

  const lastMap = lastCastMap(events);

  let lastEventTs = -Infinity;
  for (const e of events) if ((e.ts ?? 0) > lastEventTs) lastEventTs = e.ts ?? 0;
  const inCombat = lastEventTs !== -Infinity && now - lastEventTs <= o.combatWindow;

  const activeListId: "priority" | "opener" =
    inCombat ? "priority" : role.opener?.length ? "opener" : "priority";
  const activeList: Ability[] = activeListId === "opener" ? role.opener : role.priority;

  let next: ViewState["next"] = null;
  for (const a of activeList) {
    if (remainingCd(a, lastMap, now, o.gcd) <= 0) {
      next = { name: a.name, note: a.note || "", list: activeListId };
      break;
    }
  }

  const queue: QueueItem[] = [];
  for (const a of role.priority || []) {
    if (next && norm(a.name) === norm(next.name)) continue;
    const remaining = remainingCd(a, lastMap, now, o.gcd);
    queue.push({ name: a.name, note: a.note || "", remaining: round1(remaining), ready: remaining <= 0 });
    if (queue.length >= o.queueSize) break;
  }

  const refresh: RefreshItem[] = [];
  for (const a of role.maintain || []) {
    const last = lastCastOf(a, lastMap);
    if (a.duration == null) {
      if (last === -Infinity) refresh.push({ name: a.name, note: a.note || "", remaining: 0, reason: "not up" });
      continue;
    }
    const remaining = last === -Infinity ? 0 : Math.max(0, last + a.duration - now);
    if (remaining <= o.refreshLead) {
      refresh.push({
        name: a.name,
        note: a.note || "",
        remaining: round1(remaining),
        reason: last === -Infinity ? "not up" : "expired",
      });
    }
  }

  return {
    class: classData.class,
    role: role.label || roleId,
    roleId,
    inCombat,
    activeList: activeListId,
    next,
    queue,
    refresh,
  };
}
