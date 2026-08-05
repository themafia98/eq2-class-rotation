// EQ2 custom-UI overlay generator: data/*.json -> a ready-to-copy skin under dist/UI/<skin>/.
// Each role becomes its own draggable text window (guaranteed to render — no scripting/scrollbars).
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Ability, ClassData, SectionId } from "../shared/types";

const W = 320;
const PAD = 10;
const LINE_H = 16;
const TITLE_H = 20;
const SECTION_H = 18;
const GAP = 6;

const roleSuffix: Record<string, string> = { heal: "Heal", solo: "Solo", groupdps: "GrpDps", raiddps: "Raid" };

function sanitize(s: string): string {
  return String(s)
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...");
}

function xmlEscape(s: string): string {
  return sanitize(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Minimal well-formedness check; throws on malformed output. */
export function assertWellFormed(xml: string, label: string): string {
  const stack: string[] = [];
  const tag = /<(\/?)([A-Za-z_][\w.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = tag.exec(xml)) !== null) {
    if (xml.slice(idx, m.index).includes("<")) throw new Error(`${label}: stray '<' near ${idx}`);
    idx = tag.lastIndex;
    const whole = m[0];
    if (whole.startsWith("<?") || whole.startsWith("<!--")) continue;
    const closing = m[1] === "/";
    const name = m[2]!;
    const selfClose = m[4] === "/";
    if (closing) {
      if (stack.pop() !== name) throw new Error(`${label}: tag mismatch </${name}>`);
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  if (stack.length) throw new Error(`${label}: unclosed <${stack.join(">, <")}>`);
  return xml;
}

interface Line { kind: "section" | "item"; text: string; }

function roleLines(cls: ClassData, role: ClassData["roles"][number]): Line[] {
  const lines: Line[] = [];
  const sections = (cls.sections ?? ["maintain", "opener", "priority", "emergency", "cooldowns"]) as SectionId[];
  for (const sectionId of sections) {
    const items = role[sectionId] as Ability[] | undefined;
    if (!Array.isArray(items) || items.length === 0) continue;
    const label = cls.sectionLabels?.[sectionId] ?? sectionId.toUpperCase();
    lines.push({ kind: "section", text: label });
    for (const it of items) lines.push({ kind: "item", text: it.note ? `${it.name} - ${it.note}` : it.name });
  }
  return lines;
}

function renderWindow(pageName: string, title: string, x: number, y: number, lines: Line[]): string {
  const parts: string[] = ['<?xml version="1.0" encoding="utf-8"?>'];
  let h = PAD + TITLE_H + GAP;
  for (const l of lines) h += l.kind === "section" ? SECTION_H + GAP : LINE_H;
  h += PAD;
  parts.push(`<Page Name="${pageName}" Location="${x},${y}" ScrollExtent="${W},${h}" Visible="false" Draggable="true">`);
  parts.push(`  <Text Name="Title" Location="${PAD},${PAD}" ScrollExtent="${W - PAD * 2},${TITLE_H}" Font="arial_12" RGB="255,220,120" LocalText="${xmlEscape(title)}"/>`);
  let cy = PAD + TITLE_H + GAP;
  let i = 0;
  for (const l of lines) {
    i += 1;
    if (l.kind === "section") {
      parts.push(`  <Text Name="L${i}" Location="${PAD},${cy}" ScrollExtent="${W - PAD * 2},${SECTION_H}" Font="arial_12" RGB="140,200,255" LocalText="${xmlEscape(l.text)}"/>`);
      cy += SECTION_H + GAP;
    } else {
      parts.push(`  <Text Name="L${i}" Location="${PAD + 6},${cy}" ScrollExtent="${W - PAD * 2 - 6},${LINE_H}" Font="arial_10" RGB="235,235,235" LocalText="${xmlEscape(l.text)}"/>`);
      cy += LINE_H;
    }
  }
  parts.push("</Page>");
  return parts.join("\n") + "\n";
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export interface GenerateOptions {
  dataDir: string;
  outDir: string;
  skin: string;
  smoke?: boolean;
  combined?: boolean;
}

export interface GenerateResult {
  files: string[];
  toggles: { label: string; cmd: string }[];
}

export function generate(opts: GenerateOptions): GenerateResult {
  const { dataDir, outDir, smoke = false, combined = false } = opts;
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const includes: string[] = [];
  const toggles: { label: string; cmd: string }[] = [];
  const write = (name: string, xml: string): void => {
    assertWellFormed(xml, name);
    writeFileSync(join(outDir, name), xml, "utf8");
  };

  if (smoke) {
    const page = "RotSmoke";
    write("eq2ui_custom_smoke.xml", renderWindow(page, "Rotation overlay - SMOKE TEST", 400, 300, [
      { kind: "section", text: "If you can read this and drag me," },
      { kind: "item", text: "the addon loads correctly." },
    ]));
    includes.push("eq2ui_custom_smoke.xml");
    toggles.push({ label: "Smoke test", cmd: `/show_window Custom.${page}` });
  } else {
    const classes: ClassData[] = readdirSync(dataDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dataDir, f), "utf8")) as ClassData);

    for (const cls of classes) {
      const base = cls.windowName ?? "Rotation";
      const slug = cls.class.toLowerCase();
      let offsetY = 260;
      for (const role of cls.roles) {
        const page = `${base}${roleSuffix[role.id] ?? cap(role.id)}`;
        const file = `eq2ui_custom_${slug}_${role.id}.xml`;
        write(file, renderWindow(page, `${cls.title ?? cls.class} - ${role.label}`, 400, offsetY, roleLines(cls, role)));
        includes.push(file);
        toggles.push({ label: `${cls.class} ${role.label}`, cmd: `/show_window Custom.${page}` });
        offsetY += 20;
      }
      if (combined) {
        const groups: Line[] = [];
        for (const role of cls.roles) {
          groups.push({ kind: "section", text: `=== ${role.label} ===` });
          groups.push(...roleLines(cls, role));
        }
        const page = `${base}All`;
        const file = `eq2ui_custom_${slug}_all.xml`;
        write(file, renderWindow(page, `${cls.title ?? cls.class} - ALL ROLES`, 400, 120, groups));
        includes.push(file);
        toggles.push({ label: `${cls.class} ALL`, cmd: `/show_window Custom.${page}` });
      }
    }
  }

  const hook =
    `<?xml version="1.0" encoding="utf-8"?>\n<Page Name="Custom">\n` +
    includes.map((f) => `  <include>${f}</include>`).join("\n") +
    `\n</Page>\n`;
  write("eq2ui_custom.xml", hook);

  return { files: [...includes, "eq2ui_custom.xml"], toggles };
}
