// Electron main process: transparent, always-on-top overlay that shows the
// live rotation suggestion. Suggest-only — it reads the log and displays; it
// never sends input to the game.
const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");

const replayArg = process.argv.find((a) => a.startsWith("--replay="));
const replayFile = replayArg ? path.resolve(ROOT, replayArg.split("=")[1]) : null;

let win = null;
let adv = null;
let clickThrough = false;
let config = null;
let dataRoot = ROOT;       // where config.dataFile is resolved from
let userDir = null;        // editable settings dir when running as packaged .exe
let opacity = 0.92;

// When packaged into an .exe the app files live read-only inside app.asar, so
// seed an editable copy of config.json + data/*.json into the user's data dir
// on first run and read/write settings from there.
function ensureUserFiles(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const userCfg = path.join(dir, "config.json");
  if (!fs.existsSync(userCfg)) fs.copyFileSync(path.join(__dirname, "config.json"), userCfg);
  const userData = path.join(dir, "data");
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  const bundledData = path.join(ROOT, "data");
  for (const f of fs.readdirSync(bundledData)) {
    if (!f.endsWith(".json")) continue;
    const dest = path.join(userData, f);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(bundledData, f), dest);
  }
}

function initConfig() {
  if (app.isPackaged) {
    userDir = app.getPath("userData");
    ensureUserFiles(userDir);
    config = JSON.parse(fs.readFileSync(path.join(userDir, "config.json"), "utf8"));
    dataRoot = userDir;
  } else {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
    dataRoot = ROOT;
  }
  opacity = config.window?.opacity ?? 0.92;
}

function cornerPosition(w, h) {
  const wa = screen.getPrimaryDisplay().workArea;
  const m = config.window?.margin ?? 24;
  const corner = config.window?.corner ?? "top-right";
  const right = wa.x + wa.width - w - m;
  const left = wa.x + m;
  const top = wa.y + m;
  const bottom = wa.y + wa.height - h - m;
  switch (corner) {
    case "top-left": return { x: left, y: top };
    case "bottom-left": return { x: left, y: bottom };
    case "bottom-right": return { x: right, y: bottom };
    default: return { x: right, y: top };
  }
}

function createWindow() {
  const w = config.window?.width ?? 300;
  const h = config.window?.height ?? 250;
  const { x, y } = cornerPosition(w, h);
  win = new BrowserWindow({
    x, y, width: w, height: h,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setOpacity(opacity);
  win.loadFile(path.join(__dirname, "overlay.html"));
  win.webContents.on("did-finish-load", startAdvisor);
}

async function startAdvisor() {
  if (adv) return;
  const core = await import(pathToFileURL(path.join(__dirname, "core.mjs")).href);
  const classData = core.loadClassData(path.resolve(dataRoot, config.dataFile));
  adv = core.startAdvisor({
    config,
    classData,
    role: config.defaultRole,
    mode: replayFile ? "replay" : "live",
    file: replayFile || undefined,
    onState: (s) => win && !win.isDestroyed() && win.webContents.send("state", s),
  });
  sendMeta({
    class: classData.class,
    roles: classData.roles.map((r) => ({ id: r.id, label: r.label })),
    role: adv.getRole(),
    logFile: adv.logFile,
    clickThrough,
    settingsDir: userDir,
  });
}

function sendMeta(m) {
  if (win && !win.isDestroyed()) win.webContents.send("meta", m);
}

function switchRole(id) {
  adv?.setRole(id);
  sendMeta({ role: id });
}

function setOpacity(v) {
  opacity = Math.min(1, Math.max(0.2, Math.round(v * 100) / 100));
  win?.setOpacity(opacity);
}

function registerShortcuts() {
  const sc = config.shortcuts || {};
  const reg = (acc, fn) => acc && globalShortcut.register(acc, fn);
  reg(sc.roleHeal, () => switchRole("heal"));
  reg(sc.roleSolo, () => switchRole("solo"));
  reg(sc.roleGrpDps, () => switchRole("groupdps"));
  reg(sc.roleRaid, () => switchRole("raiddps"));
  reg(sc.toggleClickThrough, () => {
    clickThrough = !clickThrough;
    win?.setIgnoreMouseEvents(clickThrough, { forward: true });
    sendMeta({ clickThrough });
  });
  reg(sc.toggleShow, () => (win?.isVisible() ? win.hide() : win?.show()));
  reg(sc.opacityUp, () => setOpacity(opacity + 0.05));
  reg(sc.opacityDown, () => setOpacity(opacity - 0.05));
  reg(sc.openSettings, () => userDir && shell.openPath(userDir));
}

ipcMain.on("set-role", (_e, id) => switchRole(id));
ipcMain.on("open-settings", () => userDir && shell.openPath(userDir));

app.whenReady().then(() => {
  initConfig();
  createWindow();
  registerShortcuts();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  adv?.stop();
});
