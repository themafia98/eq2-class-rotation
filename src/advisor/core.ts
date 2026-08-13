// Orchestrator: tail/replay -> parse -> (DoT-aware) ingest -> engine -> view state.
// Also handles character/class auto-detection and live log-file switching.
// Environment-agnostic (Node built-ins only); the Electron main and the headless runner both use it.

import type { AdvisorConfig, ClassData, ViewState } from "../shared/types";
import { createParser, stripTimestamp, looksLikeCast } from "./parse";
import { computeState } from "./engine";
import { createTailer, replay, resolveLogFile, type LogSource } from "./logtail";
import { characterFromLogPath, detectClass, abilityNamesOf } from "./detect";
import { createIngestor } from "./ingest";

export interface StartAdvisorOptions {
  config: AdvisorConfig;
  classes: ClassData[];
  role?: string;
  mode?: "live" | "replay";
  file?: string;
  onState?: (s: ViewState) => void;
  onLearn?: (line: string) => void;
  onEnd?: () => void;
  onLogFile?: (file: string | null) => void;
  onActiveClass?: (cd: ClassData, character: string | null) => void;
}

export interface AdvisorHandle {
  readonly logFile: string | null;
  readonly character: string | null;
  activeClass(): ClassData;
  getRole(): string;
  setRole(id: string): void;
  /** True while the class is being auto-detected from the log (false once manually forced). */
  isAutoDetect(): boolean;
  /** Force a specific class by name and stop auto-detect. No-op if the name is unknown. */
  setClass(name: string): void;
  /** Turn log auto-detection on/off; turning on re-detects from recent casts immediately. */
  setAutoDetect(on: boolean): void;
  reloadClass(cd: ClassData): void;
  /** Re-resolve the log file from the (possibly just-changed) config and re-tail it now. */
  refreshLogSource(): void;
  stop(): void;
}

function firstRoleId(cd: ClassData): string {
  return cd.roles[0]?.id ?? "";
}

export function startAdvisor(opts: StartAdvisorOptions): AdvisorHandle {
  const { config, classes, mode = "live", onState, onLearn, onEnd, onLogFile, onActiveClass } = opts;
  const parse = createParser({
    castPatterns: config.castPatterns,
    effectPrefix: config.effectPrefix,
    effectVerbs: config.effectVerbs,
  });
  const cap = config.eventCap;
  const gcd = config.engine.gcd;

  let activeClass: ClassData =
    classes.find((c) => c.class.toLowerCase() === config.class.toLowerCase()) ?? classes[0]!;
  let currentRole = opts.role || config.defaultRole;
  let character: string | null = null;
  let logFile: string | null = null;
  let autoDetect = config.autoDetectClass;
  let sinceDetect = 0;
  let lastNow = Math.floor(Date.now() / 1000);

  const recastOf = (name: string): number => {
    const key = name.toLowerCase();
    for (const role of activeClass.roles) {
      for (const a of [...role.priority, ...role.opener, ...role.emergency, ...role.cooldowns, ...role.maintain]) {
        if (a.name.toLowerCase() === key || a.logName?.toLowerCase() === key) return a.recast ?? gcd;
      }
    }
    return gcd;
  };

  const ingestor = createIngestor(recastOf, cap);

  const ensureRole = (): void => {
    if (!activeClass.roles.some((r) => r.id === currentRole)) {
      currentRole = activeClass.roles.some((r) => r.id === config.defaultRole)
        ? config.defaultRole
        : firstRoleId(activeClass);
    }
  };

  const unlisted = (): string[] => {
    const known = abilityNamesOf(activeClass);
    return [...ingestor.seen].filter((n) => !known.has(n)).slice(0, 12);
  };

  const emit = (now: number): void => {
    lastNow = now;
    const s = computeState(activeClass, currentRole, ingestor.events, now, config.engine);
    s.character = character;
    s.unlisted = unlisted();
    onState?.(s);
  };

  const maybeDetect = (): void => {
    if (!autoDetect || classes.length < 2) return;
    if (++sinceDetect < 15) return;
    sinceDetect = 0;
    const detected = detectClass(classes, ingestor.events.slice(-60));
    if (detected && detected !== activeClass) setActiveClass(detected);
  };

  function setActiveClass(cd: ClassData): void {
    if (cd === activeClass) return;
    activeClass = cd;
    ensureRole();
    onActiveClass?.(activeClass, character);
    emit(lastNow);
  }

  const handleLine = (line: string): void => {
    const { ts } = stripTimestamp(line);
    const now = ts ?? Math.floor(Date.now() / 1000);
    const ev = parse(line, now);
    if (ev) {
      if (ingestor.push(ev)) maybeDetect();
    } else if (onLearn && looksLikeCast(line)) {
      onLearn(line);
    }
    emit(now);
  };

  // ---- log source ----------------------------------------------------------
  let source: LogSource | undefined;
  let logSwitcher: ReturnType<typeof setInterval> | undefined;

  const startTail = (file: string): void => {
    logFile = file;
    character = characterFromLogPath(file);
    source = createTailer({ file, onLine: handleLine, pollMs: 500 });
    onLogFile?.(file);
  };

  if (mode === "replay" && opts.file) {
    logFile = opts.file;
    character = characterFromLogPath(opts.file);
    source = replay({ file: opts.file, intervalMs: config.replayIntervalMs, onLine: handleLine, onEnd });
  } else {
    const first = opts.file || resolveLogFile(config);
    if (!first) {
      onState?.({
        error: "log file not found — start EQ2 and /log, or set logFile in config.json",
        role: currentRole,
        next: null,
        queue: [],
        refresh: [],
      });
    } else {
      startTail(first);
    }
    if (!opts.file) {
      logSwitcher = setInterval(() => {
        const latest = resolveLogFile(config);
        if (latest && latest !== logFile) {
          source?.stop();
          startTail(latest);
        }
      }, config.logRescanMs);
    }
  }

  let ticker: ReturnType<typeof setInterval> | undefined;
  if (mode === "live") ticker = setInterval(() => emit(Math.floor(Date.now() / 1000)), config.tickMs);

  ensureRole();
  emit(lastNow);

  return {
    get logFile() {
      return logFile;
    },
    get character() {
      return character;
    },
    activeClass: () => activeClass,
    getRole: () => currentRole,
    setRole(id: string): void {
      currentRole = id;
      emit(lastNow);
    },
    isAutoDetect: () => autoDetect,
    setClass(name: string): void {
      const cd = classes.find((c) => c.class.toLowerCase() === name.toLowerCase());
      if (!cd) return;
      autoDetect = false;
      if (cd === activeClass) {
        onActiveClass?.(activeClass, character); // re-push meta even if the class is unchanged
        emit(lastNow);
      } else {
        setActiveClass(cd);
      }
    },
    setAutoDetect(on: boolean): void {
      autoDetect = on;
      if (on) {
        const detected = detectClass(classes, ingestor.events.slice(-60));
        if (detected) setActiveClass(detected);
      }
      onActiveClass?.(activeClass, character);
      emit(lastNow);
    },
    reloadClass(cd: ClassData): void {
      const idx = classes.findIndex((c) => c.class.toLowerCase() === cd.class.toLowerCase());
      if (idx >= 0) classes[idx] = cd;
      else classes.push(cd);
      activeClass = cd;
      ensureRole();
      onActiveClass?.(activeClass, character);
      emit(lastNow);
    },
    refreshLogSource(): void {
      if (mode === "replay") return;
      const latest = resolveLogFile(config);
      if (!latest) {
        source?.stop();
        source = undefined;
        logFile = null;
        character = null;
        onLogFile?.(null);
        emit(lastNow);
        return;
      }
      if (latest === logFile && source) return;
      source?.stop();
      startTail(latest);
      emit(lastNow);
    },
    stop(): void {
      source?.stop();
      if (ticker) clearInterval(ticker);
      if (logSwitcher) clearInterval(logSwitcher);
    },
  };
}
