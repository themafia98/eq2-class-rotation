// Pure EQ2 combat-log line parser. No I/O.
//
//   (1650017527)[Fri Apr 15 12:12:07 2022] YOUR Verdict hits a wooly spider for 260 divine damage.
//
// Modern EQ2 does NOT log "You begin casting X." Abilities are visible only as their effect lines,
// "YOUR <ability> <verb> ..." (caps YOUR = the logging character's own ability; title-case "Your"
// is loot/status and is ignored). We detect casts from those, with begin-casting patterns as a
// fallback for clients/settings that emit them.

import type { CastEvent } from "../shared/types";

const TS_RE = /^\((\d+)\)\[[^\]]*\]\s?(.*)$/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile a human pattern ("You begin casting {spell}.") into a RegExp capturing the spell name. */
export function compilePattern(pattern: string): RegExp {
  const body = pattern.split("{spell}").map(escapeRe).join("(.+?)");
  return new RegExp("^" + body + "\\s*$");
}

export function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map(compilePattern);
}

export const DEFAULT_CAST_PATTERNS: string[] = [
  "You begin casting {spell}.",
  "You begin to perform {spell}.",
  "You begin channeling {spell}.",
];

export const DEFAULT_EFFECT_VERBS: string[] = [
  "hits", "heals", "wards", "reduces", "afflicts", "damages", "crushes", "pierces",
  "slashes", "burns", "freezes", "blasts", "smites", "strikes", "multi attacks",
  "flurries", "interrupts", "dispels", "mesmerizes", "stuns", "roots", "snares",
  "staggers", "taunts", "cures", "shields", "regenerates", "relieves", "absorbs",
  "restores", "drains", "steals", "mends",
];

/** ^YOUR <ability> <verb> ...  (case-sensitive: caps YOUR only, not "Your share of...") */
export function buildEffectRe(prefix: string, verbs: string[]): RegExp {
  const alts = verbs.map(escapeRe).join("|");
  return new RegExp("^" + escapeRe(prefix) + " (.+?) (?:" + alts + ")\\b");
}

export function stripTimestamp(line: string): { ts: number | null; text: string } {
  const m = TS_RE.exec(line);
  if (!m) return { ts: null, text: line.trim() };
  return { ts: Number(m[1]), text: (m[2] ?? "").trim() };
}

/** Ability-looking lines the parser didn't turn into an event — surfaced by --learn. */
export function looksLikeCast(text: string): boolean {
  return /\bbegin (?:casting|to perform|channeling)\b/i.test(text) || /^YOUR /.test(text);
}

export interface ParserOptions {
  castPatterns?: string[];
  effectPrefix?: string;
  effectVerbs?: string[];
}

export type ParseFn = (line: string, fallbackTs?: number | null) => CastEvent | null;

/** Build a parse function bound to the given config. */
export function createParser(opts: ParserOptions = {}): ParseFn {
  const compiled = compilePatterns(
    opts.castPatterns && opts.castPatterns.length ? opts.castPatterns : DEFAULT_CAST_PATTERNS
  );
  const effectRe = buildEffectRe(
    opts.effectPrefix || "YOUR",
    opts.effectVerbs && opts.effectVerbs.length ? opts.effectVerbs : DEFAULT_EFFECT_VERBS
  );
  return function parse(line, fallbackTs = null) {
    if (!line) return null;
    const { ts, text } = stripTimestamp(line);
    const when = ts ?? fallbackTs ?? 0;
    for (const re of compiled) {
      const m = re.exec(text);
      if (m && m[1]) return { ts: when, kind: "cast", name: m[1].trim(), raw: text };
    }
    const em = effectRe.exec(text);
    if (em && em[1]) return { ts: when, kind: "cast", name: em[1].trim(), raw: text };
    return null;
  };
}
