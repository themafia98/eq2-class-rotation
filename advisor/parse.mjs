// Pure EQ2 combat-log line parser. No I/O.
//
// A log line looks like:
//   (1650017527)[Fri Apr 15 12:12:07 2022] You begin casting Alleviation.
// The number in parentheses is a Unix epoch (seconds) — we use it for cooldown timing.

const TS_RE = /^\((\d+)\)\[[^\]]*\]\s?(.*)$/;

// Turn a human pattern ("You begin casting {spell}.") into a RegExp with a
// lazy capture for the spell name. Literal parts are regex-escaped.
export function compilePattern(pattern) {
  const parts = pattern.split("{spell}");
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = parts.map(esc).join("(.+?)");
  return new RegExp("^" + body + "\\s*$");
}

export function compilePatterns(patterns) {
  return patterns.map(compilePattern);
}

export const DEFAULT_CAST_PATTERNS = [
  "You begin casting {spell}.",
  "You begin to perform {spell}.",
  "You begin channeling {spell}.",
];

// Split "(epoch)[date] text" -> { ts:Number|null, text:String }.
export function stripTimestamp(line) {
  const m = TS_RE.exec(line);
  if (!m) return { ts: null, text: line.trim() };
  return { ts: Number(m[1]), text: m[2].trim() };
}

// A line that mentions casting but didn't match a pattern — used by --learn
// so the user can see their client's exact wording.
export function looksLikeCast(text) {
  return /\bbegin (?:casting|to perform|channeling)\b/i.test(text);
}

// Parse one raw log line into an event or null.
// compiled = array of RegExp from compilePatterns(). fallbackTs used when the
// line has no embedded timestamp (seconds).
export function parseLine(line, compiled, fallbackTs = null) {
  if (!line) return null;
  const { ts, text } = stripTimestamp(line);
  const when = ts ?? fallbackTs;
  for (const re of compiled) {
    const m = re.exec(text);
    if (m && m[1]) {
      return { ts: when, kind: "cast", name: m[1].trim(), raw: text };
    }
  }
  return null;
}
