#!/usr/bin/env node
// EQ2 class-rotation overlay generator.
// Reads data/*.json and emits a ready-to-copy EverQuest 2 custom-UI skin
// under dist/UI/RotationUI/. Each role becomes its own draggable text window
// (guaranteed to render — no scripting/scrollbars). Optionally --combined
// stacks all roles of a class into one tall window.
//
// Usage:
//   node src/generate.mjs                 # per-role windows (default)
//   node src/generate.mjs --combined      # also emit one all-roles window per class
//   node src/generate.mjs --smoke         # minimal 1-line test window only (validate load first)
//   node src/generate.mjs --skin=MySkin   # change output skin folder name (default RotationUI)

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

// ---- args -----------------------------------------------------------------
const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const getOpt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const SMOKE = hasFlag("--smoke");
const COMBINED = hasFlag("--combined");
const SKIN = getOpt("skin", "RotationUI");
const OUT_DIR = join(ROOT, "dist", "UI", SKIN);

// ---- layout constants -----------------------------------------------------
const W = 320;            // window width
const PAD = 10;           // inner padding
const LINE_H = 16;        // body line height
const TITLE_H = 20;
const SECTION_H = 18;
const GAP = 6;            // gap before a section header

// ---- text helpers ---------------------------------------------------------
// Old EQ2 clients are happiest with plain ASCII; fold fancy punctuation.
function sanitize(s) {
  return String(s)
    .replace(/[—–]/g, "-")   // em/en dash -> hyphen
    .replace(/[‘’]/g, "'")   // curly single quotes
    .replace(/[“”]/g, '"')   // curly double quotes
    .replace(/…/g, "...");        // ellipsis
}
function xmlEscape(s) {
  return sanitize(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---- XML well-formedness check (build fails on malformed output) ----------
function assertWellFormed(xml, label) {
  const stack = [];
  const tag = /<(\/?)([A-Za-z_][\w.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->/g;
  let m;
  let idx = 0;
  while ((m = tag.exec(xml)) !== null) {
    // reject stray unescaped '<' between tags
    const between = xml.slice(idx, m.index);
    if (between.includes("<")) throw new Error(`${label}: stray '<' in text near ${idx}`);
    idx = tag.lastIndex;
    const whole = m[0];
    if (whole.startsWith("<?") || whole.startsWith("<!--")) continue;
    const closing = m[1] === "/";
    const name = m[2];
    const selfClose = m[4] === "/";
    if (closing) {
      const top = stack.pop();
      if (top !== name) throw new Error(`${label}: tag mismatch </${name}> expected </${top}>`);
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  if (stack.length) throw new Error(`${label}: unclosed <${stack.join(">, <")}>`);
  return xml;
}

// ---- turn a role into rendered lines --------------------------------------
function roleLines(cls, role) {
  const lines = [];
  for (const sectionId of cls.sections) {
    const items = role[sectionId];
    if (!Array.isArray(items) || items.length === 0) continue;
    const label = (cls.sectionLabels && cls.sectionLabels[sectionId]) || sectionId.toUpperCase();
    lines.push({ kind: "section", text: label });
    for (const it of items) {
      const note = it.note ? ` - ${it.note}` : "";
      lines.push({ kind: "item", text: `${it.name}${note}` });
    }
  }
  return lines;
}

// ---- render one window ----------------------------------------------------
// title = header string; lineGroups = [{kind,text}] already flattened.
function renderWindow({ pageName, title, x, y, lineGroups }) {
  const parts = [];
  parts.push(`<?xml version="1.0" encoding="utf-8"?>`);

  // measure height
  let h = PAD + TITLE_H + GAP;
  for (const l of lineGroups) h += (l.kind === "section" ? SECTION_H + GAP : LINE_H);
  h += PAD;

  parts.push(
    `<Page Name="${pageName}" Location="${x},${y}" ScrollExtent="${W},${h}" ` +
      `Visible="false" Draggable="true">`
  );

  // title
  parts.push(
    `  <Text Name="Title" Location="${PAD},${PAD}" ScrollExtent="${W - PAD * 2},${TITLE_H}" ` +
      `Font="arial_12" RGB="255,220,120" LocalText="${xmlEscape(title)}"/>`
  );

  let cy = PAD + TITLE_H + GAP;
  let i = 0;
  for (const l of lineGroups) {
    i += 1;
    if (l.kind === "section") {
      cy += 0;
      parts.push(
        `  <Text Name="L${i}" Location="${PAD},${cy}" ScrollExtent="${W - PAD * 2},${SECTION_H}" ` +
          `Font="arial_12" RGB="140,200,255" LocalText="${xmlEscape(l.text)}"/>`
      );
      cy += SECTION_H + GAP;
    } else {
      parts.push(
        `  <Text Name="L${i}" Location="${PAD + 6},${cy}" ScrollExtent="${W - PAD * 2 - 6},${LINE_H}" ` +
          `Font="arial_10" RGB="235,235,235" LocalText="${xmlEscape(l.text)}"/>`
      );
      cy += LINE_H;
    }
  }

  parts.push(`</Page>`);
  return parts.join("\n") + "\n";
}

// ---- role window name (Custom.<class><Role>) ------------------------------
const roleSuffix = { heal: "Heal", solo: "Solo", groupdps: "GrpDps", raiddps: "Raid" };
function pageNameFor(cls, role) {
  const base = cls.windowName || "Rotation";
  return `${base}${roleSuffix[role.id] || cap(role.id)}`;
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- main -----------------------------------------------------------------
function loadClasses() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")));
}

function resetOut() {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
}

function write(name, xml) {
  assertWellFormed(xml, name);
  writeFileSync(join(OUT_DIR, name), xml, "utf8");
  return name;
}

function run() {
  resetOut();
  const includes = [];
  const toggles = []; // {label, cmd}

  if (SMOKE) {
    const page = "RotSmoke";
    const xml = renderWindow({
      pageName: page,
      title: "Rotation overlay - SMOKE TEST",
      x: 400,
      y: 300,
      lineGroups: [
        { kind: "section", text: "If you can read this and drag me," },
        { kind: "item", text: "the addon loads correctly. Toggle with the macro below." },
      ],
    });
    const file = `eq2ui_custom_smoke.xml`;
    write(file, xml);
    includes.push(file);
    toggles.push({ label: "Smoke test", cmd: `/show_window Custom.${page}` });
  } else {
    const classes = loadClasses();
    for (const cls of classes) {
      const base = cls.windowName || "Rotation";
      const slug = cls.class.toLowerCase();

      // per-role windows
      let offsetY = 260;
      for (const role of cls.roles) {
        const page = pageNameFor(cls, role);
        const xml = renderWindow({
          pageName: page,
          title: `${cls.title || cls.class} - ${role.label}`,
          x: 400,
          y: offsetY,
          lineGroups: roleLines(cls, role),
        });
        const file = `eq2ui_custom_${slug}_${role.id}.xml`;
        write(file, xml);
        includes.push(file);
        toggles.push({ label: `${cls.class} ${role.label}`, cmd: `/show_window Custom.${page}` });
        offsetY += 20;
      }

      // optional combined window
      if (COMBINED) {
        const groups = [];
        for (const role of cls.roles) {
          groups.push({ kind: "section", text: `=== ${role.label} ===` });
          for (const l of roleLines(cls, role)) groups.push(l);
        }
        const page = `${base}All`;
        const xml = renderWindow({
          pageName: page,
          title: `${cls.title || cls.class} - ALL ROLES`,
          x: 400,
          y: 120,
          lineGroups: groups,
        });
        const file = `eq2ui_custom_${slug}_all.xml`;
        write(file, xml);
        includes.push(file);
        toggles.push({ label: `${cls.class} ALL`, cmd: `/show_window Custom.${page}` });
      }
    }
  }

  // hook file that the root eq2ui.xml already includes
  const hook =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<Page Name="Custom">\n` +
    includes.map((f) => `  <include>${f}</include>`).join("\n") +
    `\n</Page>\n`;
  write("eq2ui_custom.xml", hook);

  // console report
  console.log(`\nBuilt EQ2 skin -> ${OUT_DIR}`);
  console.log(`Skin folder name: ${SKIN}   (eq2.ini -> cl_ui_skinname ${SKIN})`);
  console.log(`Files: ${includes.length + 1}\n`);
  console.log(`Toggle commands (put each on a hotbar macro or bind a key):`);
  for (const t of toggles) console.log(`  ${t.cmd.padEnd(34)} # ${t.label}`);
  console.log(``);
}

run();
