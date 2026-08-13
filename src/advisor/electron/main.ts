// Electron main process: transparent, always-on-top, suggest-only rotation overlay.
// Reads the log and displays; never sends input to the game.
import { app, BrowserWindow, dialog, ipcMain, globalShortcut, screen, shell } from "electron";
import { autoUpdater } from "electron-updater";
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync,
} from "node:fs";
import { join } from "node:path";
import { startAdvisor, type AdvisorHandle } from "../core";
import { loadConfig } from "../config";
import { loadClasses } from "../dataio";
import type { AdvisorConfig, ClassData, Meta } from "../../shared/types";

const APP_DIR = __dirname; // build/
const BUNDLED_CONFIG = join(APP_DIR, "assets", "default-config.json");
const BUNDLED_DATA = join(APP_DIR, "data");

const replayArg = process.argv.find((a) => a.startsWith("--replay="));
const replayFile = replayArg ? replayArg.split("=")[1] : null;

let win: BrowserWindow | null = null;
let adv: AdvisorHandle | null = null;
let config: AdvisorConfig;
let configPath = BUNDLED_CONFIG;
let dataDir = BUNDLED_DATA;
let userDir: string | null = null;
let allClasses: ClassData[] = [];
let clickThrough = false;
let opacity = 0.92;

function persistConfig(): void {
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  } catch (err) {
    console.error("could not persist config:", err);
  }
}

// ---- editable-settings seeding (refresh on version upgrade) ----------------
function seedFile(src: string, dest: string, force: boolean): void {
  if (!existsSync(dest)) {
    copyFileSync(src, dest);
    return;
  }
  if (force) {
    try {
      copyFileSync(dest, dest + ".bak");
    } catch {
      /* ignore */
    }
    copyFileSync(src, dest);
  }
}

function reseed(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = join(dir, ".seeded-version");
  let prev: string | null = null;
  try {
    prev = readFileSync(stamp, "utf8").trim();
  } catch {
    /* none */
  }
  const version = app.getVersion();
  const force = prev !== version;
  seedFile(BUNDLED_CONFIG, join(dir, "config.json"), force);
  const ud = join(dir, "data");
  if (!existsSync(ud)) mkdirSync(ud, { recursive: true });
  for (const f of readdirSync(BUNDLED_DATA)) {
    if (f.endsWith(".json")) seedFile(join(BUNDLED_DATA, f), join(ud, f), force);
  }
  try {
    writeFileSync(stamp, version);
  } catch {
    /* ignore */
  }
}

function initConfig(): void {
  if (app.isPackaged) {
    userDir = app.getPath("userData");
    reseed(userDir);
    configPath = join(userDir, "config.json");
    dataDir = join(userDir, "data");
  } else {
    configPath = BUNDLED_CONFIG;
    dataDir = BUNDLED_DATA;
  }
  config = loadConfig(configPath);
  opacity = config.window.opacity;
}

// ---- window ---------------------------------------------------------------
function cornerPosition(w: number, h: number): { x: number; y: number } {
  const wa = screen.getPrimaryDisplay().workArea;
  const m = config.window.margin;
  const right = wa.x + wa.width - w - m;
  const left = wa.x + m;
  const top = wa.y + m;
  const bottom = wa.y + wa.height - h - m;
  switch (config.window.corner) {
    case "top-left":
      return { x: left, y: top };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    default:
      return { x: right, y: top };
  }
}

function sendMeta(m: Meta): void {
  if (win && !win.isDestroyed()) win.webContents.send("meta", m);
}

function createWindow(): void {
  const { width: w, height: h } = config.window;
  const { x, y } = cornerPosition(w, h);
  win = new BrowserWindow({
    x, y, width: w, height: h,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 220,
    minHeight: 150,
    hasShadow: false,
    webPreferences: {
      preload: join(APP_DIR, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setOpacity(opacity);
  win.on("resize", onWindowResize);
  void win.loadFile(join(APP_DIR, "renderer", "overlay.html"));
  win.webContents.on("did-finish-load", startEngine);
}

// Persist the overlay size (debounced) so a resize survives restarts.
let saveSizeTimer: ReturnType<typeof setTimeout> | undefined;
function onWindowResize(): void {
  if (!win || win.isDestroyed()) return;
  const size = win.getSize();
  config.window.width = size[0] ?? config.window.width;
  config.window.height = size[1] ?? config.window.height;
  if (saveSizeTimer) clearTimeout(saveSizeTimer);
  saveSizeTimer = setTimeout(persistConfig, 500);
}

function startEngine(): void {
  if (adv) return;
  const classes = loadClasses(dataDir);
  allClasses = classes;
  adv = startAdvisor({
    config,
    classes,
    role: config.defaultRole,
    mode: replayFile ? "replay" : "live",
    file: replayFile ?? undefined,
    onState: (s) => win && !win.isDestroyed() && win.webContents.send("state", s),
    onLogFile: (file) => sendMeta({ logFile: file, character: adv?.character ?? null }),
    onActiveClass: (cd, ch) => pushMeta(cd, ch),
  });
  pushMeta(adv.activeClass(), adv.character);
}

function pushMeta(cd: ClassData, character: string | null): void {
  sendMeta({
    class: cd.class,
    roles: cd.roles.map((r) => ({ id: r.id, label: r.label })),
    role: adv?.getRole(),
    logFile: adv?.logFile ?? null,
    logsDir: config.logsDir,
    classList: allClasses.map((c) => c.class).sort(),
    autoDetect: adv?.isAutoDetect() ?? config.autoDetectClass,
    opacity,
    character,
    clickThrough,
    settingsDir: userDir,
    classData: cd,
  });
}

// ---- controls -------------------------------------------------------------
function switchRole(id: string): void {
  adv?.setRole(id);
  sendMeta({ role: id });
}

function setOpacity(v: number): void {
  opacity = Math.min(1, Math.max(0.2, Math.round(v * 100) / 100));
  win?.setOpacity(opacity);
  config.window.opacity = opacity;
  persistConfig();
  sendMeta({ opacity });
}

// Let the user point the advisor at their EQ2 logs folder directly (instead of auto-detect or
// hand-editing config.json). Persists the choice, then re-tails immediately.
async function pickLogsDir(): Promise<void> {
  if (!win) return;
  const res = await dialog.showOpenDialog(win, {
    title: "Select your EQ2 logs folder (contains eq2log_*.txt)",
    properties: ["openDirectory"],
    defaultPath: config.logsDir && config.logsDir !== "auto" ? config.logsDir : undefined,
  });
  if (res.canceled || res.filePaths.length === 0) return;
  const dir = res.filePaths[0]!;
  config.logsDir = dir; // same object the running advisor reads
  config.logFile = "auto"; // let the dir win in resolveLogFile
  persistConfig();
  adv?.refreshLogSource();
  sendMeta({ logFile: adv?.logFile ?? null, logsDir: config.logsDir, character: adv?.character ?? null });
}

function registerShortcuts(): void {
  const sc = config.shortcuts;
  const reg = (acc: string | undefined, fn: () => void): void => {
    if (acc) globalShortcut.register(acc, fn);
  };
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
  reg(sc.toggleEditor, () => win?.webContents.send("toggle-editor"));
  reg(sc.opacityUp, () => setOpacity(opacity + 0.05));
  reg(sc.opacityDown, () => setOpacity(opacity - 0.05));
  reg(sc.openSettings, () => userDir && shell.openPath(userDir));
}

// ---- IPC from renderer ----------------------------------------------------
ipcMain.on("set-role", (_e, id: string) => switchRole(id));
ipcMain.on("set-class", (_e, name: string) => {
  adv?.setClass(name);
  config.class = name;
  config.autoDetectClass = false;
  persistConfig();
  if (adv) pushMeta(adv.activeClass(), adv.character);
});
ipcMain.on("set-auto-detect", (_e, on: boolean) => {
  adv?.setAutoDetect(on);
  config.autoDetectClass = on;
  persistConfig();
  if (adv) pushMeta(adv.activeClass(), adv.character);
});
ipcMain.on("set-opacity", (_e, v: number) => setOpacity(v));
ipcMain.on("resize-by", (_e, dx: number, dy: number) => {
  if (!win || win.isDestroyed()) return;
  const size = win.getSize();
  const w = size[0] ?? config.window.width;
  const h = size[1] ?? config.window.height;
  win.setSize(Math.max(220, Math.round(w + dx)), Math.max(150, Math.round(h + dy)));
});
ipcMain.on("open-settings", () => userDir && shell.openPath(userDir));
ipcMain.on("pick-logs-dir", () => void pickLogsDir());
ipcMain.on("restart-to-update", () => autoUpdater.quitAndInstall());
ipcMain.on("save-class", (_e, data: ClassData) => {
  try {
    const file = join(dataDir, `${data.class.toLowerCase()}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
    adv?.reloadClass(data);
  } catch (err) {
    console.error("save-class failed:", err);
  }
});

// ---- auto-update (packaged only; portable can't self-update) ---------------
function initAutoUpdate(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-downloaded", () => sendMeta({ updateReady: true }));
  autoUpdater.on("error", (e) => console.error("updater:", e?.message ?? e));
  void autoUpdater.checkForUpdates();
}

app.whenReady().then(() => {
  initConfig();
  createWindow();
  registerShortcuts();
  initAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  adv?.stop();
});
