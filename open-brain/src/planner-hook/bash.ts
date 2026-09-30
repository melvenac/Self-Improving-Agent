import { isProtectedArtifactPath, isRenderedViewPath, toRepoRelative } from "./paths.js";

export const BASH_WRITE_LIMIT =
  "Static Bash write detection only: redirects, sed -i, tee, cp and mv targets. " +
  "It stops mistakes by the planner's tools; it is not a sandbox.";

// A token is a quoted string (repo paths here contain spaces, so they arrive quoted) or a bare word.
const TOK = `"[^"]*"|'[^']*'|[^\\s|;&]+`;
const REDIRECT_RE = new RegExp(`(?:^|[\\s|;&])(?:\\d*>>?)\\s*(${TOK})`, "g");
const SED_I_RE = new RegExp(`\\bsed\\s+-i(?:\\S*)\\s+(?:${TOK})\\s+(${TOK})`);
const TEE_RE = new RegExp(`\\btee\\s+(?:-[a-zA-Z]+\\s+)*(${TOK})`);
const CP_MV_RE = new RegExp(`\\b(?:cp|mv)\\s+(?:-[a-zA-Z]+\\s+)*(?:${TOK})\\s+(${TOK})`);

function stripQuotes(token: string): string {
  const t = token.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** The text to report when the target is refused, or null when it is fine. */
function refusedWriteTarget(raw: string, repoRoot: string, cwd: string): string | null {
  const p = stripQuotes(raw);
  if (!p || p === "/dev/null" || p.startsWith("&") || p.startsWith("/dev/")) return null;
  // A shell expands these before writing, so the static text does not say where the write lands.
  if (/[$`]/.test(p)) return `${p} (contains a shell expansion, so its location cannot be determined)`;
  const rel = toRepoRelative(p, repoRoot, cwd);
  if (!rel.ok) return rel.cause;
  if (rel.outside) return null;
  return isProtectedArtifactPath(rel.rel, rel.ci) || isRenderedViewPath(rel.rel, rel.ci) ? p : null;
}

/**
 * PH-6: statically detected write targets that hit PH-1/PH-2 paths. Every target is resolved
 * against the shell's cwd (T-194 r4, D3) and made repo-relative, so an absolute path or a
 * relative one from a subdirectory is checked as its repo-relative form. A path outside the
 * repo is allowed; one whose location cannot be determined is refused with its cause.
 */
export function detectBashWriteTargets(command: string, repoRoot: string, cwd: string = repoRoot): string[] {
  const hits: string[] = [];
  const add = (target: string | undefined): void => {
    if (target === undefined) return;
    const hit = refusedWriteTarget(target, repoRoot, cwd);
    if (hit) hits.push(hit);
  };

  for (const m of command.matchAll(REDIRECT_RE)) add(m[1]);
  add(command.match(SED_I_RE)?.[1]);
  add(command.match(TEE_RE)?.[1]);
  add(command.match(CP_MV_RE)?.[1]);

  return hits;
}
