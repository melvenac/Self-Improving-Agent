/** Fixed marker substituted for redacted secret material in trigger fire logs. */
export const COMMAND_LOG_REDACTED = "[REDACTED]";

export const COMMAND_LOG_MAX_LEN = 200;

const TOKEN_PREFIXES = /\b(?:ghp_|gho_|github_pat_|sk-|xox[bpas]-)\S+/gi;

const GIT_SHA_40 = /\b[0-9a-f]{40}\b/g;

function redactKnownPrefixes(s: string): string {
  return s.replace(TOKEN_PREFIXES, COMMAND_LOG_REDACTED);
}

function redactUrlSecrets(s: string): string {
  let out = s.replace(
    /([a-z][a-z0-9+.-]*):\/\/([^/\s@]+):([^@\s/]+)@/gi,
    `$1://${COMMAND_LOG_REDACTED}@`,
  );
  out = out.replace(/x-access-token:([^@\s/]+)@/gi, `x-access-token:${COMMAND_LOG_REDACTED}@`);
  return out;
}

function redactHeaders(s: string): string {
  let out = s.replace(/\bAuthorization:\s*[^\n]+/gi, `Authorization: ${COMMAND_LOG_REDACTED}`);
  out = out.replace(/\bBearer\s+\S+/gi, `Bearer ${COMMAND_LOG_REDACTED}`);
  out = out.replace(/\bX-[A-Za-z-]*Api[A-Za-z-]*-Key:\s*\S+/gi, (m) => m.replace(/:\s*\S+$/, `: ${COMMAND_LOG_REDACTED}`));
  return out;
}

function redactCliFlags(s: string): string {
  let out = s.replace(
    /--(token|key|password|api[-_]?key|access-token|client-secret|secret)\s*(?:=\s*|\s+)(\S+)/gi,
    `--$1 ${COMMAND_LOG_REDACTED}`,
  );
  out = out.replace(/-p(\S+)/g, `-p${COMMAND_LOG_REDACTED}`);
  out = out.replace(/\bcurl\b([^;|]*?)-u\s+(\S+)/gi, (m, mid, cred) => m.replace(cred, COMMAND_LOG_REDACTED));
  return out;
}

function redactEnvAssignments(s: string): string {
  return s.replace(
    /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(\S+)/g,
    `$1=${COMMAND_LOG_REDACTED}`,
  );
}

function redactJsonAndColonSecrets(s: string): string {
  let out = s.replace(
    /"([^"]*(?:key|token|secret|password)[^"]*)"\s*:\s*"([^"]+)"/gi,
    `"$1": "${COMMAND_LOG_REDACTED}"`,
  );
  out = out.replace(
    /\b([a-z_]*(?:api_key|apikey|access_token|client_secret)[a-z_]*)\s*:\s*(\S+)/gi,
    `$1: ${COMMAND_LOG_REDACTED}`,
  );
  return out;
}

function redactQuotedSecrets(s: string): string {
  return s.replace(/'([^'\\]|\\.)*'/g, (q) => {
    const inner = q.slice(1, -1);
    if (inner.length >= 8 || /(?:key|token|secret|pass)/i.test(inner)) {
      return `'${COMMAND_LOG_REDACTED}'`;
    }
    return q;
  });
}

function redactLongOpaqueRuns(s: string): string {
  const placeholders = new Map<string, string>();
  let n = 0;
  const shielded = s.replace(GIT_SHA_40, (sha) => {
    const token = `__GIT_SHA_${n++}__`;
    placeholders.set(token, sha);
    return token;
  });
  let out = shielded.replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, COMMAND_LOG_REDACTED);
  out = out.replace(/\b[0-9a-fA-F]{33,39}\b/gi, COMMAND_LOG_REDACTED);
  out = out.replace(/\b[0-9a-fA-F]{41,}\b/gi, COMMAND_LOG_REDACTED);
  for (const [token, sha] of placeholders) out = out.replaceAll(token, sha);
  return out;
}

/**
 * Bounded, redacted command text for `trigger_fires` (and derived `recall_log.query`).
 * `recall_log` does not store the raw command — only the derived query — but the query
 * can still echo secret fragments from the command, so apply the same treatment.
 */
export function sanitizeCommandLogText(text: string): string {
  let s = text;
  s = redactUrlSecrets(s);
  s = redactHeaders(s);
  s = redactCliFlags(s);
  s = redactEnvAssignments(s);
  s = redactJsonAndColonSecrets(s);
  s = redactQuotedSecrets(s);
  s = redactKnownPrefixes(s);
  s = redactLongOpaqueRuns(s);

  if (s.length > COMMAND_LOG_MAX_LEN) {
    s = `${s.slice(0, COMMAND_LOG_MAX_LEN)}…`;
  }
  return s;
}
