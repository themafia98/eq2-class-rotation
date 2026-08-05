// File tailing for the advisor. Node built-ins only.
// - createTailer: follow a growing log file, emit each new complete line.
// - replay: feed a static log file line-by-line on a timer (for testing/demo).
// - resolveLogFile: find the newest eq2log_*.txt under a logs directory.

import { statSync, openSync, readSync, closeSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { watchFile, unwatchFile } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Common EQ2 logs locations to probe when logsDir is "auto".
const COMMON_LOG_DIRS = [
  // Steam installs
  "C:/Program Files (x86)/Steam/steamapps/common/EverQuest 2/logs",
  "C:/Program Files/Steam/steamapps/common/EverQuest 2/logs",
  "D:/Steam/steamapps/common/EverQuest 2/logs",
  "D:/SteamLibrary/steamapps/common/EverQuest 2/logs",
  "E:/SteamLibrary/steamapps/common/EverQuest 2/logs",
  // Daybreak / Sony launcher installs (default + common custom folders)
  "C:/games/Daybreak Game Company/Installed Games/EverQuest II/logs",
  "D:/games/Daybreak Game Company/Installed Games/EverQuest II/logs",
  "C:/Users/Public/Daybreak Game Company/Installed Games/EverQuest II/logs",
  "C:/Program Files/Sony/EverQuest II/logs",
  "C:/Program Files (x86)/Sony/EverQuest II/logs",
  join(homedir(), "Daybreak Game Company/Installed Games/EverQuest II/logs"),
];

function newestEq2Log(dir) {
  if (!existsSync(dir)) return null;
  let best = null;
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/^eq2log_.*\.txt$/i.test(ent.name)) {
        const mtime = statSync(p).mtimeMs;
        if (!best || mtime > best.mtime) best = { path: p, mtime };
      }
    }
  };
  try { walk(dir); } catch { /* ignore unreadable dirs */ }
  return best?.path ?? null;
}

// Returns an absolute log path or null. config: { logFile, logsDir }.
export function resolveLogFile(config) {
  if (config.logFile && config.logFile !== "auto") return config.logFile;
  const dirs = config.logsDir && config.logsDir !== "auto" ? [config.logsDir] : COMMON_LOG_DIRS;
  for (const d of dirs) {
    const hit = newestEq2Log(d);
    if (hit) return hit;
  }
  return null;
}

// Follow a growing file. Starts at current EOF (only new lines). Handles
// truncation/rotation by resetting to 0 when the file shrinks.
export function createTailer({ file, onLine, pollMs = 500, fromStart = false }) {
  let offset = fromStart ? 0 : safeSize(file);
  let pending = "";

  const read = () => {
    let size;
    try { size = statSync(file).size; } catch { return; }
    if (size < offset) { offset = 0; pending = ""; } // truncated/rotated
    if (size === offset) return;
    const fd = openSync(file, "r");
    try {
      const len = size - offset;
      const buf = Buffer.allocUnsafe(len);
      const n = readSync(fd, buf, 0, len, offset);
      offset += n;
      pending += buf.toString("utf8", 0, n);
      let nl;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
        if (line) onLine(line);
      }
    } finally {
      closeSync(fd);
    }
  };

  const listener = () => read();
  watchFile(file, { interval: pollMs }, listener);
  read(); // pick up anything already past offset (usually nothing)

  return {
    stop() { unwatchFile(file, listener); },
  };
}

function safeSize(file) {
  try { return statSync(file).size; } catch { return 0; }
}

// Replay a static log file: emit each line every intervalMs. Returns { stop }.
export function replay({ file, onLine, intervalMs = 350, onEnd }) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.length > 0);
  let i = 0;
  const timer = setInterval(() => {
    if (i >= lines.length) {
      clearInterval(timer);
      onEnd?.();
      return;
    }
    onLine(lines[i++]);
  }, intervalMs);
  return { stop() { clearInterval(timer); } };
}
