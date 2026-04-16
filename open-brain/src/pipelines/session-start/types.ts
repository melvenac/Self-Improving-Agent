export interface SessionStartOptions {
  projectRoot: string;
  homePath: string;
}

export type SessionMode = "project" | "lightweight" | "meta";

export interface ProjectState {
  mode: SessionMode;
  version: string;
  summary: string | null;
  inbox: string | null;
  taskFile: string | null;
  nextSession: string | null;
  hasAgents: boolean;
  hasMeta: boolean;
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
}
