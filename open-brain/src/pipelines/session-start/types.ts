import type { State } from "../../shared/state-schema.js";

export interface SessionStartOptions {
  projectRoot: string;
  homePath: string;
  /**
   * Authoritative session UUID, when the caller already knows it (hook payload
   * or a prior ob_set_session). Falls back to transcript discovery if omitted.
   */
  sessionId?: string | null;
  /**
   * Per-file line budget for the four state files. Omitted means NO truncation:
   * the caller gets the whole file. When a budget is set and a file exceeds it,
   * the file is cut at the budget and its size entry carries `truncated: true`,
   * so a cut file can never be mistaken for an absent or short one.
   */
  stateBudgetLines?: number;
}

export type SessionMode = "project" | "lightweight" | "meta";

/** The four prose files plus, when present, `.agents/state.json`. */
export type StateFileKey = "summary" | "inbox" | "taskFile" | "nextSession" | "stateJson";

/**
 * Size instrumentation for one state file, measured on the content actually
 * returned (post-truncation). `sourceLines` is the file's full line count so a
 * truncated entry also says how much was cut. `estTokens` is chars/4, rounded
 * up — a coarse estimator, chosen because it needs no tokenizer and is stable
 * across runs; treat it as an order-of-magnitude figure, not a billing number.
 */
export interface StateFileSize {
  file: StateFileKey;
  path: string;
  present: boolean;
  lines: number;
  sourceLines: number;
  words: number;
  estTokens: number;
  truncated: boolean;
}

/**
 * `.agents/state.json` as read. Absent and invalid are different results:
 * `{present: false}` means no file; `{present: true, valid: false, error}`
 * means a file that failed the strict schema, with the zod path in `error`.
 */
export interface StateJsonResult {
  present: boolean;
  valid: boolean;
  error?: string;
  data?: State;
}

export interface ProjectState {
  mode: SessionMode;
  version: string;
  summary: string | null;
  inbox: string | null;
  taskFile: string | null;
  nextSession: string | null;
  hasAgents: boolean;
  hasMeta: boolean;
  /**
   * One entry per prose file, in the order summary, inbox, taskFile,
   * nextSession; a fifth `stateJson` entry only when that file is present, so
   * the block is byte-identical to v0.28.0 when it is not.
   */
  sizes: StateFileSize[];
  stateJson: StateJsonResult;
}

export interface DriftResult {
  field: string;
  expected: string;
  actual: string;
  fixed: boolean;
}

export interface SessionInfo {
  sessionId: string | null;
  sessionNumber: number;
  logPath: string;
  /** True when an existing Session_N.md already carried this session id and was reused. */
  reused: boolean;
  /** Set when no log was created and the caller should say why (e.g. no SESSIONS/ dir). */
  skippedReason: string | null;
}

export interface HealthCheckResult {
  warnings: Array<{ category: string; message: string }>;
  pendingSkillProposals: number;
}

export interface SessionStartResult {
  state: ProjectState;
  drift: DriftResult[];
  session: SessionInfo;
  health: HealthCheckResult;
  recalledEntryIds: number[];
  /** Same entries as state.sizes, surfaced at the top level so callers can pin them. */
  sizes: StateFileSize[];
}
