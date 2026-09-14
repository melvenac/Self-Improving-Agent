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

export type StateFileKey = "summary" | "inbox" | "taskFile" | "nextSession";

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

export interface ProjectState {
  mode: SessionMode;
  version: string;
  summary: string | null;
  inbox: string | null;
  taskFile: string | null;
  nextSession: string | null;
  hasAgents: boolean;
  hasMeta: boolean;
  /** One entry per state file, in the order summary, inbox, taskFile, nextSession. */
  sizes: StateFileSize[];
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
