import { readProjectState } from "./state-reader.js";
import { discoverSessionUuid } from "./session-discovery.js";
import { detectDrift } from "./drift-detector.js";
import { findNextSessionNumber, createSessionLog } from "./session-log.js";
import { runHealthChecks } from "./health-checks.js";
import type { SessionStartOptions, SessionStartResult } from "./types.js";

export function sessionStart(options: SessionStartOptions): SessionStartResult {
  const state = readProjectState(options.projectRoot);
  const drift = detectDrift(state);
  // Prefer a UUID the caller already knows. Transcript discovery is a fallback
  // for mid-session callers only — it cannot identify a session that has not
  // written its .jsonl yet, and picks the newest by mtime regardless of owner.
  const sessionId =
    options.sessionId ?? discoverSessionUuid(options.projectRoot, options.homePath);
  const health = runHealthChecks(options.homePath);

  let session = { sessionId, sessionNumber: 0, logPath: "" };

  if (state.hasAgents) {
    const sessionNumber = findNextSessionNumber(options.projectRoot);
    const date = new Date().toISOString().split("T")[0];
    const logPath = createSessionLog(options.projectRoot, sessionNumber, sessionId, date);
    session = { sessionId, sessionNumber, logPath };
  }

  return { state, drift, session, health, recalledEntryIds: [] };
}

export type { SessionStartOptions, SessionStartResult } from "./types.js";
