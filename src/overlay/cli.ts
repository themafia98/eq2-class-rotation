#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./generate";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");
const args = process.argv.slice(2);
const getOpt = (n: string, d: string): string => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const has = (f: string): boolean => args.includes(f);

const skin = getOpt("skin", "RotationUI");
const res = generate({
  dataDir: join(ROOT, "data"),
  outDir: join(ROOT, "dist", "UI", skin),
  skin,
  smoke: has("--smoke"),
  combined: has("--combined"),
});

console.log(`\nBuilt EQ2 skin -> dist/UI/${skin}  (${res.files.length} files)`);
console.log(`eq2.ini -> cl_ui_skinname ${skin}\n`);
for (const t of res.toggles) console.log(`  ${t.cmd.padEnd(34)} # ${t.label}`);
console.log("");
