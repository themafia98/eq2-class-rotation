// Wires the tailer + parser + engine together. Reused by the headless runner
// and the Electron main process (via dynamic import). Node built-ins only.

import { readFileSync } from "node:fs";
import { createParser, stripTimestamp, looksLikeCast } from "./parse.mjs";
import { computeState } from "./engine.mjs";
import { createTailer, replay, resolveLogFile } from "./logtail.mjs";

export function loadClassData(dataFile) {
  return JSON.parse(readFileSync(dataFile, "utf8"));
}

// opts: { config, classData, role, mode:'live'|'replay', file, onState, onLearn, onEnd }
// Returns { stop, setRole, getRole, logFile }.
export function startAdvisor(opts) {
  const { config, classData, mode = "live", onState, onLearn, onEnd } = opts;
  const parse = createParser({
    castPatterns: config.castPatterns,
    effectPrefix: config.effectPrefix,
    effectVerbs: config.effectVerbs,
  });
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
    const ev = parse(line, now);
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
  let logSwitcher = null;
  if (mode === "replay") {
    logFile = opts.file;
    source = replay({
      file: opts.file,
      intervalMs: config.replayIntervalMs ?? 350,
      onLine: handleLine,
      onEnd,
    });
  } else {
    const startTail = (file) => {
      logFile = file;
      source = createTailer({ file, onLine: handleLine, pollMs: 500 });
      opts.onLogFile?.(file);
    };
    const first = opts.file || resolveLogFile(config);
    if (!first) {
      onState?.({ error: "log file not found — start EQ2 and /log, or set logFile in config.json", role: currentRole, next: null, queue: [], refresh: [] });
    } else {
      startTail(first);
    }
    // Auto-switch to a newer log file if one appears (e.g. you started EQ2 after
    // the advisor, or logged in a different character). Only when auto-detecting.
    if (!opts.file) {
      logSwitcher = setInterval(() => {
        const latest = resolveLogFile(config);
        if (latest && latest !== logFile) {
          source?.stop?.();
          startTail(latest);
        }
      }, config.logRescanMs ?? 5000);
    }
  }

  // live mode: tick so countdowns/idle update between log lines
  let ticker = null;
  if (mode === "live") {
    ticker = setInterval(() => emit(Math.floor(Date.now() / 1000)), config.tickMs ?? 250);
  }

  emit(lastNow); // initial paint

  return {
    get logFile() { return logFile; },
    getRole: () => currentRole,
    setRole(id) {
      currentRole = id;
      emit(lastNow);
    },
    stop() {
      source?.stop?.();
      if (ticker) clearInterval(ticker);
      if (logSwitcher) clearInterval(logSwitcher);
    },
  };
}
