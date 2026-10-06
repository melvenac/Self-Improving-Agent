/** Fixed marker substituted for redacted secret material in trigger fire logs. */
export const COMMAND_LOG_REDACTED = "[REDACTED]";

export const COMMAND_LOG_MAX_LEN = 200;

/**
 * Bounded, redacted command text for `trigger_fires` (and derived `recall_log.query`).
 * `recall_log` does not store the raw command — only the derived query — but the query
 * can still echo secret fragments from the command, so apply the same treatment.
 */
export function sanitizeCommandLogText(text: string): string {
  let s = text;

  s = s.replace(
    /--(token|key|password|api[-_]?key)\s*(?:=\s*|\s+)(\S+)/gi,
    `--$1 ${COMMAND_LOG_REDACTED}`,
  );

  s = s.replace(
    /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(\S+)/gi,
    `$1=${COMMAND_LOG_REDACTED}`,
  );

  s = s.replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, COMMAND_LOG_REDACTED);
  s = s.replace(/\b[0-9a-fA-F]{32,}\b/g, COMMAND_LOG_REDACTED);

  if (s.length > COMMAND_LOG_MAX_LEN) {
    s = `${s.slice(0, COMMAND_LOG_MAX_LEN)}…`;
  }
  return s;
}
