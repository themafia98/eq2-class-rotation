// File tailing for the advisor. Node built-ins only.

import {
  statSync, openSync, readSync, closeSync, existsSync, readdirSync, readFileSync,
  watchFile, unwatchFile,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface LogSource {
  stop(): void;
}

const COMMON_LOG_DIRS: string[] = [
  "C:/Program Files (x86)/Steam/steamapps/common/EverQuest 2/logs",
  "C:/Program Files/Steam/steamapps/common/EverQuest 2/logs",
  "D:/Steam/steamapps/common/EverQuest 2/logs",
  "D:/SteamLibrary/steamapps/common/EverQuest 2/logs",
  "E:/SteamLibrary/steamapps/common/EverQuest 2/logs",
  "C:/games/Daybreak Game Company/Installed Games/EverQuest II/logs",
  "D:/games/Daybreak Game Company/Installed Games/EverQuest II/logs",
  "C:/Users/Public/Daybreak Game Company/Installed Games/EverQuest II/logs",
  "C:/Program Files/Sony/EverQuest II/logs",
  "C:/Program Files (x86)/Sony/EverQuest II/logs",
  join(homedir(), "Daybreak Game Company/Installed Games/EverQuest II/logs"),
];

function newestEq2Log(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const found: { path: string; mtime: number }[] = [];
  const walk = (d: string): void => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/^eq2log_.*\.txt$/i.test(ent.name)) found.push({ path: p, mtime: statSync(p).mtimeMs });
    }
  };
  try {
    walk(dir);
  } catch {
    /* ignore unreadable dirs */
  }
  if (found.length === 0) return null;
  return found.reduce((a, b) => (b.mtime > a.mtime ? b : a)).path;
}

export interface ResolveLogArgs {
  logFile: string;
  logsDir: string;
}

export function resolveLogFile(config: ResolveLogArgs): string | null {
  if (config.logFile && config.logFile !== "auto") return config.logFile;
  const dirs = config.logsDir && config.logsDir !== "auto" ? [config.logsDir] : COMMON_LOG_DIRS;
  for (const d of dirs) {
    const hit = newestEq2Log(d);
    if (hit) return hit;
  }
  return null;
}

export interface TailerOptions {
  file: string;
  onLine: (line: string) => void;
  pollMs?: number;
  fromStart?: boolean;
}

function safeSize(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

/** Follow a growing file from its current end; handles truncation/rotation. */
export function createTailer(opts: TailerOptions): LogSource {
  const { file, onLine, pollMs = 500, fromStart = false } = opts;
  let offset = fromStart ? 0 : safeSize(file);
  let pending = "";

  const read = (): void => {
    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      return;
    }
    if (size < offset) {
      offset = 0;
      pending = "";
    }
    if (size === offset) return;
    const fd = openSync(file, "r");
    try {
      const len = size - offset;
      const buf = Buffer.allocUnsafe(len);
      const n = readSync(fd, buf, 0, len, offset);
      offset += n;
      pending += buf.toString("utf8", 0, n);
      let nl: number;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
        if (line) onLine(line);
      }
    } finally {
      closeSync(fd);
    }
  };

  const listener = (): void => read();
  watchFile(file, { interval: pollMs }, listener);
  read();

  return {
    stop() {
      unwatchFile(file, listener);
    },
  };
}

export interface ReplayOptions {
  file: string;
  onLine: (line: string) => void;
  intervalMs?: number;
  onEnd?: () => void;
}

/** Replay a static log file, one line per intervalMs. */
export function replay(opts: ReplayOptions): LogSource {
  const { file, onLine, intervalMs = 350, onEnd } = opts;
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.length > 0);
  let i = 0;
  const timer = setInterval(() => {
    if (i >= lines.length) {
      clearInterval(timer);
      onEnd?.();
      return;
    }
    onLine(lines[i++]!);
  }, intervalMs);
  return {
    stop() {
      clearInterval(timer);
    },
  };
}
