import { existsSync } from "node:fs";
import { join } from "node:path";
import { readProjectState } from "./state-reader.js";
import { discoverSessionUuid } from "./session-discovery.js";
import { detectDrift } from "./drift-detector.js";
import { findExistingSessionLog, createSessionLog, nextGreetingSessionNumber } from "./session-log.js";
import { runHealthChecks } from "./health-checks.js";
import type { SessionInfo, SessionStartOptions, SessionStartResult } from "./types.js";

export function sessionStart(options: SessionStartOptions): SessionStartResult {
  const state = readProjectState(options.projectRoot, { stateBudgetLines: options.stateBudgetLines });
  const drift = detectDrift(state);
  // undefined discovers. null does not: ob_start passes null when it cannot
  // prove a session, and discovery would stamp the newest transcript in the
  // checkout, which belongs to another session (T-003 D1).
  const sessionId =
    options.sessionId === undefined
      ? discoverSessionUuid(options.projectRoot, options.homePath)
      : options.sessionId;
  const health = runHealthChecks(options.homePath);

  let session: SessionInfo = { sessionId, sessionNumber: 0, logPath: "", reused: false, skippedReason: null };

  if (state.hasAgents) {
    const sessionsDir = join(options.projectRoot, ".agents", "SESSIONS");
    if (!existsSync(sessionsDir)) {
      // Absent is not silent: the caller prints this instead of a blank block.
      session.skippedReason = "no .agents/SESSIONS/ dir — log not created";
    } else {
      const unreadableLogs: string[] = [];
      const existing = findExistingSessionLog(options.projectRoot, sessionId, (name) => unreadableLogs.push(name));
      // T-048: a log that could not be read may have been this session's own; say so rather than mint a duplicate in silence.
      if (unreadableLogs.length > 0) {
        health.warnings.push({
          category: "session-log",
          message: `${unreadableLogs.length} session log(s) in .agents/SESSIONS could not be read (${unreadableLogs.join(", ")}); the search for this session's existing log skipped them.`,
        });
      }
      if (existing) {
        session = { sessionId, ...existing, reused: true, skippedReason: null };
      } else {
        const { sessionNumber, source } = nextGreetingSessionNumber(options.projectRoot, state.stateJson);
        const date = new Date().toISOString().split("T")[0];
        const logPath = createSessionLog(options.projectRoot, sessionNumber, sessionId, date);
        session = {
          sessionId,
          sessionNumber,
          logPath,
          reused: false,
          skippedReason: null,
          sessionNumberSource: source,
        };
      }
    }
  }

  return { state, drift, session, health, recalledEntryIds: [], sizes: state.sizes };
}

export type { SessionStartOptions, SessionStartResult, StateFileSize, StateJsonResult } from "./types.js";
