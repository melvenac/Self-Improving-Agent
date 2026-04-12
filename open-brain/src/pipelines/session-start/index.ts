import { readProjectState } from "./state-reader.js";
import { discoverSessionUuid } from "./session-discovery.js";
import { detectDrift } from "./drift-detector.js";
import { findNextSessionNumber, createSessionLog } from "./session-log.js";
import type { SessionStartOptions, SessionStartResult } from "./types.js";

export function sessionStart(options: SessionStartOptions): SessionStartResult {
  const state = readProjectState(options.projectRoot);
  const drift = detectDrift(state);
  const sessionId = discoverSessionUuid(options.projectRoot, options.homePath);

  let session = { sessionId, sessionNumber: 0, logPath: "" };

  if (state.hasAgents) {
    const sessionNumber = findNextSessionNumber(options.projectRoot);
    const date = new Date().toISOString().split("T")[0];
    const logPath = createSessionLog(options.projectRoot, sessionNumber, sessionId, date);
    session = { sessionId, sessionNumber, logPath };
  }

  return { state, drift, session, recalledEntryIds: [] };
}

export type { SessionStartOptions, SessionStartResult } from "./types.js";
