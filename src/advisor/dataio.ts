import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ClassData } from "../shared/types";

export function loadClass(file: string): ClassData {
  return JSON.parse(readFileSync(file, "utf8")) as ClassData;
}

/** Load every class definition (data/*.json) from a directory. */
export function loadClasses(dir: string): ClassData[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadClass(join(dir, f)));
}
