// One-off build aid (NOT shipped runtime): pull EoF-era ability NAMES per class from the
// public ZAM/fanbyte EQ2 database. Fetches each class's ability list, extracts name + level,
// keeps level <= 70 (EoF cap), and writes a candidate-names JSON we hand-curate into data/*.json.
//
//   node scripts/fetch-eq2-abilities.mjs [outFile]
//
// Names are BEST-EFFORT: the ZAM snapshot is post-EoF, so level<=70 approximates the EoF kit.
// They get verified against the player's real combat log by the advisor.

import { writeFileSync } from "node:fs";

const CLASSES = [
  "Guardian", "Berserker", "Monk", "Bruiser", "Paladin", "Shadowknight",
  "Templar", "Inquisitor", "Warden", "Fury", "Mystic", "Defiler",
  "Wizard", "Warlock", "Conjuror", "Necromancer", "Illusionist", "Coercer",
  "Ranger", "Assassin", "Brigand", "Swashbuckler", "Troubador", "Dirge",
];

const EOF_CAP = 70;
const UA = "Mozilla/5.0 (eq2-class-rotation build aid)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rows live in <table class="datatable ..."> as:
//   <tr> <td><img ...></td> <td>LEVEL</td> <td><a href="/db/ability.html?...">NAME</a><br>desc</td> </tr>
// We match each level cell immediately followed by an ability-link cell.
function parseAbilities(html) {
  const out = new Map(); // name -> min level seen
  const decode = (s) =>
    s.replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();

  const rowRe = /<td>\s*(\d{1,3})\s*<\/td>\s*<td>\s*<a[^>]+href="[^"]*\/db\/ability\.html[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const level = Number(m[1]);
    const name = decode(m[2]);
    if (!name) continue;
    const prev = out.get(name);
    if (prev === undefined || level < prev) out.set(name, level);
  }
  return out;
}

async function fetchClass(cls) {
  const url = `https://eq2.fanbyte.com/db/abilitylist.html?class=${encodeURIComponent(cls)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${cls}: HTTP ${res.status}`);
  const html = await res.text();
  const abilities = parseAbilities(html);
  const kept = [...abilities.entries()]
    .filter(([, lvl]) => lvl <= EOF_CAP)
    .sort((a, b) => a[1] - b[1])
    .map(([name, level]) => ({ name, level }));
  return kept;
}

async function main() {
  const outFile = process.argv[2] || "eq2-abilities.json";
  const result = {};
  for (const cls of CLASSES) {
    try {
      const abilities = await fetchClass(cls);
      result[cls] = abilities;
      console.log(`${cls.padEnd(14)} ${abilities.length} abilities <= L${EOF_CAP}`);
    } catch (err) {
      console.error(`${cls.padEnd(14)} FAILED: ${err.message}`);
      result[cls] = [];
    }
    await sleep(1200); // be polite
  }
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${outFile}`);
}

main();
