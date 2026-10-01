import { normalize, posix } from "node:path";

/** Normalise a repo-relative path to forward slashes, no leading ./ */
export function normalizeRelPath(raw: string): string {
  const n = posix.normalize(raw.replace(/\\/g, "/")).replace(/^\.\//, "");
  return n.startsWith("../") ? n : n;
}

/**
 * `outside: true` is a path whose location is known and is not in the repo: the hook protects the
 * repo's artifacts and is not a sandbox, so such a path is ALLOWED (T-194 r4). `ok: false` is a
 * path whose location cannot be determined, refused with a named cause. `ci` is true when the
 * repo is on a Windows drive, where NTFS matches names case-insensitively.
 */
export type RepoRelative =
  | { ok: true; outside: false; rel: string; ci: boolean }
  | { ok: true; outside: true }
  | { ok: false; cause: string };

const WIN_DRIVE_RE = /^[A-Za-z]:\//;

/** A Windows 8.3 short name (PROGRA~1) hides the real directory name; the disk is needed to resolve it. */
const SHORT_NAME_RE = /(?:^|[\\/])[^\\/]*~\d[^\\/]*(?:[\\/]|$)/;

function toFwd(raw: string, winRoot: boolean): string {
  // The long-path prefixes (backslash backslash ? backslash, and the dot form) name the same file as the plain
  // drive path; left alone they read as an outside UNC path.
  const p = raw.trim().replace(/\\/g, "/").replace(/^\/\/[?.]\//, "");
  const bash = winRoot ? p.match(/^(?:\/cygdrive|\/mnt)?\/([A-Za-z])(\/.*)?$/) : null;
  return bash ? `${bash[1]}:${bash[2] ?? "/"}` : p;
}

/**
 * NTFS ignores trailing dots and spaces in a name and treats `name:stream` as a stream of `name`, so
 * `open-brain/src./x.ts` and `open-brain/src/x.ts:s` are protected files. Applied on a Windows root only.
 */
function ntfsComponents(abs: string): string {
  return abs
    .split("/")
    .map((c) => (c === "." || c === ".." || /^[A-Za-z]:$/.test(c) ? c : c.replace(/:.*$/, "").replace(/[. ]+$/, "")))
    .join("/");
}

/**
 * T-194 r3 (D1) + r4 (D3): Claude Code's Edit/Write send ABSOLUTE paths, and a shell resolves a
 * RELATIVE one against its cwd (which Claude Code keeps between Bash calls), so every target is
 * resolved against `cwd` (the repo root when omitted) and then made relative to the repo root
 * before the PH-1/PH-2 prefix checks. Accepts both slash forms and, when the root is a Windows
 * path, Git Bash's `/c/...` form. A path outside the root is `outside`; a relative path with no
 * usable absolute cwd cannot be located and is refused with a named cause.
 */
export function toRepoRelative(raw: string, repoRoot: string, cwd: string = repoRoot): RepoRelative {
  const root = posix.normalize(repoRoot.replace(/\\/g, "/")).replace(/\/+$/, "");
  const winRoot = WIN_DRIVE_RE.test(root);
  let p = toFwd(raw, winRoot);
  if (!p.startsWith("/") && !WIN_DRIVE_RE.test(p)) {
    const base = toFwd(cwd, winRoot).replace(/\/+$/, "");
    if (!base.startsWith("/") && !WIN_DRIVE_RE.test(base)) {
      return { ok: false, cause: `${raw} is relative and the working directory (${cwd}) is not an absolute path, so its location cannot be determined` };
    }
    p = `${base}/${p}`;
  }
  const abs = winRoot ? ntfsComponents(posix.normalize(p)) : posix.normalize(p);
  const a = winRoot ? abs.toLowerCase() : abs;
  const r = winRoot ? root.toLowerCase() : root;
  if (a === r) return { ok: true, outside: false, rel: ".", ci: winRoot };
  if (a.startsWith(`${r}/`)) return { ok: true, outside: false, rel: abs.slice(root.length + 1), ci: winRoot };
  // A path that matched the root prefix was resolved above. One that did not, but carries a Windows 8.3 short
  // name (PROGRA~1), may still be inside: the real directory name is on the disk, not in the text.
  // Only a short name AFTER the point where the path leaves the root's own spelling counts: a sibling that shares
  // the root's (short-named) ancestors is outside beyond doubt.
  const ac = a.split("/");
  const rc = r.split("/");
  let shared = 0;
  while (shared < ac.length && shared < rc.length && ac[shared] === rc[shared]) shared++;
  if (ac.slice(shared).some((c) => SHORT_NAME_RE.test(c))) {
    return { ok: false, cause: `${raw} contains an 8.3 short name, so its location cannot be determined` };
  }
  return { ok: true, outside: true };
}

const ARTIFACT_PREFIXES = [
  "open-brain/src/",
  "open-brain/tests/",
  "scripts/",
  "open-brain/build/",
  "hooks/",
];

/** PH-1: source, tests, hooks, scripts, build output, package.json */
export function isProtectedArtifactPath(raw: string, ci = false): boolean {
  const p = ci ? normalizeRelPath(raw).toLowerCase() : normalizeRelPath(raw);
  if (p === "package.json" || p.endsWith("/package.json")) return true;
  return ARTIFACT_PREFIXES.some((pref) => p === pref.slice(0, -1) || p.startsWith(pref));
}

const RENDERED_VIEW_PATHS = new Set([
  ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md",
  ".agents/SESSIONS/next-session.md",
  ".agents/state.json",
]);

const RENDERED_VIEW_PATHS_CI = new Set([...RENDERED_VIEW_PATHS].map((p) => p.toLowerCase()));

export const SUMMARY_PATH = ".agents/SYSTEM/SUMMARY.md";

/** PH-2: rendered views and state.json (SUMMARY handled separately). */
export function isRenderedViewPath(raw: string, ci = false): boolean {
  const p = normalizeRelPath(raw);
  return ci ? RENDERED_VIEW_PATHS_CI.has(p.toLowerCase()) : RENDERED_VIEW_PATHS.has(p);
}

/** True when `rel` is SUMMARY.md, matching case-insensitively when `ci`. */
export function isSummaryPath(rel: string, ci = false): boolean {
  return ci ? rel.toLowerCase().endsWith(SUMMARY_PATH.toLowerCase()) : rel.endsWith(SUMMARY_PATH);
}

/** PH-4: planner may write loop briefs here without a grant. */
export function isAllowedDocsLoopsPath(raw: string): boolean {
  const p = normalizeRelPath(raw);
  return p === "docs/loops" || p.startsWith("docs/loops/");
}

/**
 * T-194 r5, P1: a write target must be a LITERAL path or it is refused. The hook cannot expand a
 * `~`, a variable, a command substitution, a glob or a brace list, so it does not guess: it names the cause.
 * `shell` also refuses parentheses (process substitution, subshell); a file tool's path has no shell around it.
 */
export function nonLiteralCause(text: string, shell: boolean): string | null {
  if (text.startsWith("~")) return "starts with ~, which a shell expands to a home directory";
  if (/[$`]/.test(text)) return "contains a shell expansion";
  if (/[*?[\]]/.test(text)) return "contains a glob pattern";
  if (/[{}]/.test(text)) return "contains a brace expansion";
  if (shell && /[()]/.test(text)) return "contains a parenthesis (process substitution or subshell)";
  return null;
}

/** A target that writes to no file at all: the null device and descriptor sinks. */
export function isNullSink(text: string): boolean {
  const t = text.trim();
  return t === "/dev/null" || t.startsWith("/dev/") || t === "$null" || t.toLowerCase() === "nul";
}

export type TargetVerdict =
  | { kind: "refused"; cause: string }
  | { kind: "protected"; rel: string }
  | { kind: "ok" };

/**
 * THE canonicaliser (P1). Every caller - Bash and PowerShell redirects, sed/tee/cp/mv, the PowerShell
 * cmdlets, and the Edit/Write file tools - gets its verdict here, from the location the tool will
 * actually write to: resolved against `cwd`, slashes normalised, `.`/`..` applied, case folded on a
 * Windows drive, and only then compared with the protected paths.
 */
export function classifyTarget(
  text: string,
  raw: string,
  expands: boolean,
  repoRoot: string,
  cwd: string,
  shell: boolean,
): TargetVerdict {
  if (text === "") {
    return { kind: "refused", cause: `${raw || "(empty)"} (no readable target, so its location cannot be determined)` };
  }
  if (isNullSink(text)) return { kind: "ok" };
  const nl = (expands ? "contains a shell expansion" : null) ?? nonLiteralCause(text, shell) ?? nonLiteralCause(raw, shell);
  if (nl) return { kind: "refused", cause: `${text} (${nl}, so its location cannot be determined)` };
  const rel = toRepoRelative(text, repoRoot, cwd);
  if (!rel.ok) return { kind: "refused", cause: rel.cause };
  if (rel.outside) return { kind: "ok" };
  return isProtectedArtifactPath(rel.rel, rel.ci) || isRenderedViewPath(rel.rel, rel.ci)
    ? { kind: "protected", rel: rel.rel }
    : { kind: "ok" };
}
