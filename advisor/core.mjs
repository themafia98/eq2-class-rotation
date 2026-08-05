// Wires the tailer + parser + engine together. Reused by the headless runner
// and the Electron main process (via dynamic import). Node built-ins only.

import { readFileSync } from "node:fs";
import {
  compilePatterns,
  parseLine,
  stripTimestamp,
  looksLikeCast,
  DEFAULT_CAST_PATTERNS,
} from "./parse.mjs";
import { computeState } from "./engine.mjs";
import { createTailer, replay, resolveLogFile } from "./logtail.mjs";

export function loadClassData(dataFile) {
  return JSON.parse(readFileSync(dataFile, "utf8"));
}

// opts: { config, classData, role, mode:'live'|'replay', file, onState, onLearn, onEnd }
// Returns { stop, setRole, getRole, logFile }.
export function startAdvisor(opts) {
  const { config, classData, mode = "live", onState, onLearn, onEnd } = opts;
  const patterns = compilePatterns(
    config.castPatterns?.length ? config.castPatterns : DEFAULT_CAST_PATTERNS
  );
  const cap = config.eventCap ?? 400;
  const engineOpts = config.engine || {};
  const events = [];
  let currentRole = opts.role || config.defaultRole;
  let lastNow = Math.floor(Date.now() / 1000);

  const emit = (now) => {
    lastNow = now;
    onState?.(computeState(classData, currentRole, events, now, engineOpts));
  };

  const handleLine = (line) => {
    const { ts } = stripTimestamp(line);
    const now = ts ?? Math.floor(Date.now() / 1000);
    const ev = parseLine(line, patterns, now);
    if (ev) {
      events.push(ev);
      if (events.length > cap) events.shift();
    } else if (onLearn && looksLikeCast(line)) {
      onLearn(line);
    }
    emit(now);
  };

  // pick the source
  let source;
  let logFile = null;
  if (mode === "replay") {
    logFile = opts.file;
    source = replay({
      file: opts.file,
      intervalMs: config.replayIntervalMs ?? 350,
      onLine: handleLine,
      onEnd,
    });
  } else {
    logFile = opts.file || resolveLogFile(config);
    if (!logFile) {
      onState?.({ error: "log file not found — set logFile in advisor/config.json", role: currentRole, next: null, queue: [], refresh: [] });
    } else {
      source = createTailer({ file: logFile, onLine: handleLine, pollMs: 500 });
    }
  }

  // live mode: tick so countdowns/idle update between log lines
  let ticker = null;
  if (mode === "live") {
    ticker = setInterval(() => emit(Math.floor(Date.now() / 1000)), config.tickMs ?? 250);
  }

  emit(lastNow); // initial paint

  return {
    logFile,
    getRole: () => currentRole,
    setRole(id) {
      currentRole = id;
      emit(lastNow);
    },
    stop() {
      source?.stop?.();
      if (ticker) clearInterval(ticker);
    },
  };
}
