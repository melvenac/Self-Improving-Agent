import type { HealthCheckResult, SessionInfo } from "./types.js";

/**
 * T-048 round 2: what the two scans in `ob_start` could not read, printed at zero as well.
 *
 * The first round warned only when the count was above zero, which leaves "nothing was unreadable" and "the scan did
 * not run" looking the same (no line). A count that exists only when it is non-zero is the collapse the invariant names.
 * Each line says a number, or says the scan did not run and why.
 *
 * T-329 (N4): zero reads `all readable`, and a scan that did not run reads `not searched yet` / `not scanned yet` with its
 * reason, so a clean fresh install prints no fault-shaped line. Both lines stay printed; a count above zero is unchanged.
 */
export function formatScanCounts(session: Pick<SessionInfo, "unreadableLogs">, health: Pick<HealthCheckResult, "transcriptDirsUnreadable">): string[] {
  return [
    session.unreadableLogs === undefined
      ? "Session logs: not searched yet (no session id, or no .agents/SESSIONS directory)"
      : session.unreadableLogs === 0
        ? "Session logs: all readable"
        : `Session logs unreadable: ${session.unreadableLogs}`,
    health.transcriptDirsUnreadable === null || health.transcriptDirsUnreadable === undefined
      ? "Transcript directories: not scanned yet (no ~/.claude/projects directory)"
      : health.transcriptDirsUnreadable === 0
        ? "Transcript directories: all readable"
        : `Transcript directories unreadable: ${health.transcriptDirsUnreadable}`,
  ];
}
