import type { HealthCheckResult, SessionInfo } from "./types.js";

/**
 * T-048 round 2: what the two scans in `ob_start` could not read, printed at zero as well.
 *
 * The first round warned only when the count was above zero, which leaves "nothing was unreadable" and "the scan did
 * not run" looking the same (no line). A count that exists only when it is non-zero is the collapse the invariant names.
 * Each line says a number, or says the scan did not run and why.
 */
export function formatScanCounts(session: Pick<SessionInfo, "unreadableLogs">, health: Pick<HealthCheckResult, "transcriptDirsUnreadable">): string[] {
  return [
    session.unreadableLogs === undefined
      ? "Session logs unreadable: not searched (no session id, or no .agents/SESSIONS directory)"
      : `Session logs unreadable: ${session.unreadableLogs}`,
    health.transcriptDirsUnreadable === null || health.transcriptDirsUnreadable === undefined
      ? "Transcript directories unreadable: not scanned (no ~/.claude/projects directory)"
      : `Transcript directories unreadable: ${health.transcriptDirsUnreadable}`,
  ];
}
