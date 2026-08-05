// Pure EQ2 combat-log line parser. No I/O.
//
// A log line looks like:
//   (1650017527)[Fri Apr 15 12:12:07 2022] YOUR Verdict hits a wooly spider for 260 divine damage.
// The number in parentheses is a Unix epoch (seconds) — we use it for cooldown timing.
//
// IMPORTANT: modern EQ2 clients do NOT log "You begin casting <spell>." lines. What they DO
// log is the *effect* of your abilities as "YOUR <ability> <verb> ..." (caps YOUR = the logging
// character's own ability; "Your ..." title-case is loot/status and is ignored). So we detect
// ability use from those effect lines. As a fallback we still support explicit begin-casting
// patterns for clients/settings that emit them.

const TS_RE = /^\((\d+)\)\[[^\]]*\]\s?(.*)$/;

// Turn a human pattern ("You begin casting {spell}.") into a RegExp with a
// lazy capture for the spell name. Literal parts are regex-escaped.
export function compilePattern(pattern) {
  const parts = pattern.split("{spell}");
  const body = parts.map(escapeRe).join("(.+?)");
  return new RegExp("^" + body + "\\s*$");
}

export function compilePatterns(patterns) {
  return patterns.map(compilePattern);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const DEFAULT_CAST_PATTERNS = [
  "You begin casting {spell}.",
  "You begin to perform {spell}.",
  "You begin channeling {spell}.",
];

// Verbs that follow an ability name on a "YOUR <ability> <verb> ..." effect line.
export const DEFAULT_EFFECT_VERBS = [
  "hits", "heals", "wards", "reduces", "afflicts", "damages", "crushes", "pierces",
  "slashes", "burns", "freezes", "blasts", "smites", "strikes", "multi attacks",
  "flurries", "interrupts", "dispels", "mesmerizes", "stuns", "roots", "snares",
  "staggers", "taunts", "cures", "shields", "regenerates", "relieves", "absorbs",
  "restores", "drains", "steals", "mends",
];

// ^YOUR <ability> <verb> ...   (case-sensitive: caps YOUR only, not "Your share of...")
export function buildEffectRe(prefix, verbs) {
  const alts = verbs.map(escapeRe).join("|");
  return new RegExp("^" + escapeRe(prefix) + " (.+?) (?:" + alts + ")\\b");
}

// Split "(epoch)[date] text" -> { ts:Number|null, text:String }.
export function stripTimestamp(line) {
  const m = TS_RE.exec(line);
  if (!m) return { ts: null, text: line.trim() };
  return { ts: Number(m[1]), text: m[2].trim() };
}

// A line worth surfacing in --learn (ability-looking lines the parser didn't turn
// into an event) so the user can see their client's exact wording.
export function looksLikeCast(text) {
  return /\bbegin (?:casting|to perform|channeling)\b/i.test(text) || /^YOUR /.test(text);
}

// Build a parse function bound to the given config. Returns (line, fallbackTs) -> event | null.
// opts: { castPatterns, effectPrefix, effectVerbs }
export function createParser(opts = {}) {
  const compiled = compilePatterns(
    opts.castPatterns?.length ? opts.castPatterns : DEFAULT_CAST_PATTERNS
  );
  const effectRe = buildEffectRe(
    opts.effectPrefix || "YOUR",
    opts.effectVerbs?.length ? opts.effectVerbs : DEFAULT_EFFECT_VERBS
  );
  return function parse(line, fallbackTs = null) {
    if (!line) return null;
    const { ts, text } = stripTimestamp(line);
    const when = ts ?? fallbackTs;
    for (const re of compiled) {
      const m = re.exec(text);
      if (m && m[1]) return { ts: when, kind: "cast", name: m[1].trim(), raw: text };
    }
    const em = effectRe.exec(text);
    if (em && em[1]) return { ts: when, kind: "cast", name: em[1].trim(), raw: text };
    return null;
  };
}
