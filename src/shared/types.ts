// Domain model + typed IPC contract. Single source of truth shared by the pure core,
// the Electron main/preload, and the renderer.

export type SectionId = "maintain" | "opener" | "priority" | "emergency" | "cooldowns";

export interface Ability {
  name: string;
  note?: string;
  /** seconds until reusable (priority/opener) */
  recast?: number;
  /** seconds a maintain buff/debuff lasts */
  duration?: number;
  /** name in the combat log if different from the display name */
  logName?: string;
  /** damage-over-time: ticks repeatedly in the log */
  dot?: boolean;
}

export interface Role {
  id: string;
  label: string;
  blurb?: string;
  maintain: Ability[];
  opener: Ability[];
  priority: Ability[];
  emergency: Ability[];
  cooldowns: Ability[];
}

export interface ClassData {
  class: string;
  title?: string;
  windowName?: string;
  sections?: SectionId[];
  sectionLabels?: Partial<Record<SectionId, string>>;
  roles: Role[];
}

export interface EngineOpts {
  gcd: number;
  combatWindow: number;
  queueSize: number;
  refreshLead: number;
}

export interface WindowOpts {
  opacity: number;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  width: number;
  height: number;
  margin: number;
}

export interface AdvisorConfig {
  class: string;
  dataFile: string;
  logsDir: string;
  logFile: string;
  defaultRole: string;
  autoDetectClass: boolean;
  castPatterns: string[];
  effectPrefix: string;
  effectVerbs: string[];
  engine: EngineOpts;
  eventCap: number;
  replayIntervalMs: number;
  tickMs: number;
  logRescanMs: number;
  window: WindowOpts;
  shortcuts: Record<string, string>;
}

export interface CastEvent {
  ts: number;
  kind: "cast";
  name: string;
  raw: string;
}

export interface QueueItem {
  name: string;
  note: string;
  remaining: number;
  ready: boolean;
}

export interface NextItem {
  name: string;
  note: string;
  list: string;
}

export interface RefreshItem {
  name: string;
  note: string;
  remaining: number;
  reason: string;
}

export interface ViewState {
  class?: string;
  role?: string;
  roleId?: string;
  inCombat?: boolean;
  activeList?: string;
  next: NextItem | null;
  queue: QueueItem[];
  refresh: RefreshItem[];
  /** abilities seen in the log that aren't in the current role (for the editor "add" list) */
  unlisted?: string[];
  character?: string | null;
  error?: string;
}

export interface RoleMeta {
  id: string;
  label: string;
}

export interface Meta {
  class?: string;
  roles?: RoleMeta[];
  role?: string;
  logFile?: string | null;
  /** currently-configured logs directory ("auto" = auto-detect) */
  logsDir?: string | null;
  clickThrough?: boolean;
  settingsDir?: string | null;
  character?: string | null;
  updateReady?: boolean;
  /** full editable class data, sent so the in-overlay editor can render/save it */
  classData?: ClassData;
}

/** Bridge exposed by preload as window.advisor */
export interface AdvisorApi {
  onState(cb: (s: ViewState) => void): void;
  onMeta(cb: (m: Meta) => void): void;
  setRole(id: string): void;
  openSettings(): void;
  pickLogsDir(): void;
  saveClass(data: ClassData): void;
  restartToUpdate(): void;
  onToggleEditor(cb: () => void): void;
}

declare global {
  interface Window {
    advisor: AdvisorApi;
  }
}
