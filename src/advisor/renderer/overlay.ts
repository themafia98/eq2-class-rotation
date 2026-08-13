// Overlay renderer. Renders live state + hosts the in-overlay rotation editor.
import type { Ability, ClassData, Meta, Role, ViewState } from "../../shared/types";

const CD_SCALE = 30; // seconds mapped to a full cooldown bar

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

let roles: { id: string; label: string }[] = [];
let currentRole = "";
let classData: ClassData | null = null;
let unlisted: string[] = [];
let classList: string[] = [];
let currentClass = "";
let autoDetect = true;
let opacity = 0.92;

// ---- live view ------------------------------------------------------------
function renderTabs(): void {
  const box = byId("tabs");
  box.innerHTML = "";
  for (const r of roles) {
    const el = document.createElement("span");
    el.className = "tab" + (r.id === currentRole ? " active" : "");
    el.textContent = r.label;
    el.onclick = () => window.advisor.setRole(r.id);
    box.appendChild(el);
  }
}

function renderState(s: ViewState): void {
  if (Array.isArray(s.unlisted)) unlisted = s.unlisted;
  const next = byId("next");
  if (s.error) {
    next.className = "next waiting";
    next.textContent = s.error;
    byId("nextNote").textContent = "";
    byId("queue").innerHTML = "";
    byId("refresh").innerHTML = "";
    return;
  }
  if (s.roleId) currentRole = s.roleId;

  if (s.next) {
    next.className = "next";
    next.textContent = s.next.name;
    byId("nextNote").textContent = s.next.note ?? "";
  } else {
    next.className = "next waiting";
    next.textContent = "waiting… (all on cooldown)";
    byId("nextNote").textContent = "";
  }

  const q = byId("queue");
  q.innerHTML = "";
  for (const item of s.queue) {
    const row = document.createElement("div");
    row.className = "q" + (item.ready ? " ready" : "");
    const pct = item.ready ? 100 : Math.max(4, 100 - Math.min(item.remaining / CD_SCALE, 1) * 100);
    row.innerHTML = '<span class="name"></span><span class="barwrap"><span class="bar"></span></span><span class="t"></span>';
    (row.querySelector(".name") as HTMLElement).textContent = item.name;
    (row.querySelector(".bar") as HTMLElement).style.width = pct + "%";
    (row.querySelector(".t") as HTMLElement).textContent = item.ready ? "rdy" : item.remaining + "s";
    q.appendChild(row);
  }

  const rf = byId("refresh");
  rf.innerHTML = "";
  for (const r of s.refresh) {
    const p = document.createElement("span");
    p.className = "pill";
    p.textContent = "⟳ " + r.name;
    rf.appendChild(p);
  }
  renderTabs();
}

function applyMeta(m: Meta): void {
  if (m.class) {
    currentClass = m.class;
    const auto = m.autoDetect ?? autoDetect ? " (auto)" : "";
    byId("cls").textContent = (m.character ? `${m.character} · ${m.class}` : m.class) + auto;
  }
  if (m.roles) roles = m.roles;
  if (m.role) currentRole = m.role;
  if (m.classData) classData = m.classData;
  if (m.classList) classList = m.classList;
  if (typeof m.autoDetect === "boolean") autoDetect = m.autoDetect;
  if (typeof m.opacity === "number") opacity = m.opacity;
  if (!byId("settings").classList.contains("hidden")) renderSettings();
  if ("logFile" in m) {
    byId("dot").className = "dot" + (m.logFile ? " on" : "");
    byId("status").textContent = m.logFile ? "log connected" : "no log — 📁 pick folder";
  }
  if ("logsDir" in m) {
    const d = m.logsDir && m.logsDir !== "auto" ? m.logsDir : "auto-detect";
    byId<HTMLElement>("logsBtn").title = `Choose EQ2 logs folder (now: ${d})`;
  }
  if (m.settingsDir) byId<HTMLElement>("gear").style.display = "inline";
  if (m.updateReady) byId("banner").classList.remove("hidden");
  renderTabs();
}

// ---- editor ---------------------------------------------------------------
let draft: ClassData | null = null;

function activeRole(cd: ClassData): Role | undefined {
  return cd.roles.find((r) => r.id === currentRole);
}

function openEditor(): void {
  if (!classData) return;
  draft = JSON.parse(JSON.stringify(classData)) as ClassData;
  const role = activeRole(draft);
  byId("edTitle").textContent = `Edit ${draft.class} — ${role?.label ?? currentRole} priority`;
  renderEditor();
  byId("editor").classList.remove("hidden");
}

function closeEditor(): void {
  draft = null;
  byId("editor").classList.add("hidden");
}

function renderEditor(): void {
  if (!draft) return;
  const role = activeRole(draft);
  if (!role) return;
  const list = byId("edList");
  list.innerHTML = "";
  role.priority.forEach((ab, i) => {
    const row = document.createElement("div");
    row.className = "ed-row";
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = ab.name;
    const rc = document.createElement("input");
    rc.type = "number";
    rc.min = "0";
    rc.value = String(ab.recast ?? "");
    rc.title = "recast (s)";
    rc.onchange = () => {
      const v = Number(rc.value);
      if (rc.value === "") delete ab.recast;
      else ab.recast = v;
    };
    const up = mkBtn("↑", () => move(role.priority, i, -1));
    const dn = mkBtn("↓", () => move(role.priority, i, 1));
    const del = mkBtn("✕", () => {
      role.priority.splice(i, 1);
      renderEditor();
    });
    row.append(up, dn, nm, rc, del);
    list.appendChild(row);
  });

  const add = byId<HTMLSelectElement>("edAdd");
  add.innerHTML = '<option value="">+ add ability…</option>';
  const present = new Set(role.priority.map((a) => a.name.toLowerCase()));
  for (const name of unlisted) {
    if (present.has(name.toLowerCase())) continue;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    add.appendChild(opt);
  }
}

function mkBtn(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = fn;
  return b;
}

function move(arr: Ability[], i: number, dir: number): void {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  const a = arr[i];
  const b = arr[j];
  if (!a || !b) return;
  arr[i] = b;
  arr[j] = a;
  renderEditor();
}

function addAbility(): void {
  if (!draft) return;
  const role = activeRole(draft);
  const sel = byId<HTMLSelectElement>("edAdd");
  const name = sel.value.trim();
  if (!role || !name) return;
  role.priority.push({ name, note: "(added)" });
  renderEditor();
}

function saveEditor(): void {
  if (draft) window.advisor.saveClass(draft);
  closeEditor();
}

// ---- settings -------------------------------------------------------------
function renderSettings(): void {
  const sel = byId<HTMLSelectElement>("setClass");
  sel.innerHTML = "";
  const autoOpt = document.createElement("option");
  autoOpt.value = "__auto__";
  autoOpt.textContent = "Auto-detect";
  sel.appendChild(autoOpt);
  for (const name of classList) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  }
  sel.value = autoDetect ? "__auto__" : currentClass;
  byId<HTMLInputElement>("setOpacityRange").value = String(Math.round(opacity * 100));
  byId("setHint").textContent = autoDetect
    ? `Auto-detecting from your log${currentClass ? ` — now: ${currentClass}` : ""}. Pick a class to lock it.`
    : `Locked to ${currentClass}. Choose Auto-detect to follow the log again.`;
}

function openSettingsPanel(): void {
  closeEditor();
  renderSettings();
  byId("settings").classList.remove("hidden");
}

function closeSettingsPanel(): void {
  byId("settings").classList.add("hidden");
}

// ---- wire up --------------------------------------------------------------
byId("gear").onclick = () => openSettingsPanel();
byId("logsBtn").onclick = () => window.advisor.pickLogsDir();
byId("editBtn").onclick = () => openEditor();
byId("banner").onclick = () => window.advisor.restartToUpdate();
byId("edCancel").onclick = () => closeEditor();
byId("edSave").onclick = () => saveEditor();
byId("edAddBtn").onclick = () => addAbility();

byId<HTMLSelectElement>("setClass").onchange = () => {
  const v = byId<HTMLSelectElement>("setClass").value;
  if (v === "__auto__") window.advisor.setAutoDetect(true);
  else window.advisor.setClass(v);
};
byId<HTMLInputElement>("setOpacityRange").oninput = () => {
  window.advisor.setOpacity(Number(byId<HTMLInputElement>("setOpacityRange").value) / 100);
};
byId("setLogsBtn").onclick = () => window.advisor.pickLogsDir();
byId("setOpenFolder").onclick = () => window.advisor.openSettings();
byId("setDone").onclick = () => closeSettingsPanel();

// ---- resize grip (drag the corner to resize the overlay) ------------------
let resizing = false;
let lastX = 0;
let lastY = 0;
byId("grip").addEventListener("mousedown", (e: MouseEvent) => {
  resizing = true;
  lastX = e.screenX;
  lastY = e.screenY;
  e.preventDefault();
});
window.addEventListener("mousemove", (e: MouseEvent) => {
  if (!resizing) return;
  const dx = e.screenX - lastX;
  const dy = e.screenY - lastY;
  lastX = e.screenX;
  lastY = e.screenY;
  if (dx || dy) window.advisor.resizeBy(dx, dy);
});
window.addEventListener("mouseup", () => {
  resizing = false;
});

window.advisor.onState(renderState);
window.advisor.onMeta(applyMeta);
window.advisor.onToggleEditor(() => {
  if (byId("editor").classList.contains("hidden")) openEditor();
  else closeEditor();
});
