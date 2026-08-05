// Pure rotation engine. No I/O. Given the class data, the active role, the
// stream of cast events, and the current time, decide what to suggest.
//
// It is a *reference* aid: cooldowns are estimated from when you cast (per the
// log) plus each ability's `recast`. There is no server-side cooldown/GCD/power
// data available, so treat output as guidance, not ground truth.

const DEFAULTS = { gcd: 1.0, combatWindow: 8, queueSize: 3, refreshLead: 0 };

const norm = (s) => String(s || "").trim().toLowerCase();

// Which log-name does this ability answer to? (display name unless overridden)
function logNamesOf(ability) {
  const names = [ability.name];
  if (ability.logName) names.push(ability.logName);
  return names.map(norm);
}

// Build { normalizedName -> latest ts } from cast events.
export function lastCastMap(events) {
  const m = new Map();
  for (const e of events) {
    if (e.kind !== "cast") continue;
    const key = norm(e.name);
    const ts = e.ts ?? 0;
    if (!m.has(key) || ts > m.get(key)) m.set(key, ts);
  }
  return m;
}

function lastCastOf(ability, lastMap) {
  let best = -Infinity;
  for (const n of logNamesOf(ability)) {
    if (lastMap.has(n)) best = Math.max(best, lastMap.get(n));
  }
  return best;
}

function remainingCd(ability, lastMap, now, gcd) {
  const last = lastCastOf(ability, lastMap);
  if (last === -Infinity) return 0; // never cast -> ready
  const recast = ability.recast ?? gcd;
  return Math.max(0, last + recast - now);
}

export function computeState(classData, roleId, events, now, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const role = (classData.roles || []).find((r) => r.id === roleId) || null;
  if (!role) {
    return { error: `unknown role: ${roleId}`, role: roleId, next: null, queue: [], refresh: [] };
  }

  const lastMap = lastCastMap(events);

  // combat state: any cast recently?
  let lastEventTs = -Infinity;
  for (const e of events) if ((e.ts ?? 0) > lastEventTs) lastEventTs = e.ts ?? 0;
  const inCombat = lastEventTs !== -Infinity && now - lastEventTs <= o.combatWindow;

  // idle / pre-pull -> show opener; active combat -> show sustained priority
  const activeListId = inCombat ? "priority" : role.opener?.length ? "opener" : "priority";
  const activeList = role[activeListId] || role.priority || [];

  // next = first ability in the active list that is ready
  let next = null;
  for (const a of activeList) {
    if (remainingCd(a, lastMap, now, o.gcd) <= 0) {
      next = { name: a.name, note: a.note || "", list: activeListId };
      break;
    }
  }

  // queue = priority list with remaining cooldowns (priority order), excluding `next`
  const queue = [];
  for (const a of role.priority || []) {
    if (next && norm(a.name) === norm(next.name)) continue;
    const remaining = remainingCd(a, lastMap, now, o.gcd);
    queue.push({ name: a.name, note: a.note || "", remaining: round1(remaining), ready: remaining <= 0 });
    if (queue.length >= o.queueSize) break;
  }

  // refresh = maintain items whose duration lapsed (or never cast)
  const refresh = [];
  for (const a of role.maintain || []) {
    const last = lastCastOf(a, lastMap);
    if (a.duration == null) {
      if (last === -Infinity) refresh.push({ name: a.name, note: a.note || "", remaining: 0, reason: "not up" });
      continue;
    }
    const remaining = last === -Infinity ? 0 : Math.max(0, last + a.duration - now);
    if (remaining <= o.refreshLead) {
      refresh.push({ name: a.name, note: a.note || "", remaining: round1(remaining), reason: last === -Infinity ? "not up" : "expired" });
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

function round1(n) {
  return Math.round(n * 10) / 10;
}
