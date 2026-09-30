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

function toFwd(raw: string, winRoot: boolean): string {
  const p = raw.trim().replace(/\\/g, "/");
  const bash = winRoot ? p.match(/^\/([A-Za-z])(\/.*)?$/) : null;
  return bash ? `${bash[1]}:${bash[2] ?? "/"}` : p;
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
  const abs = posix.normalize(p);
  const a = winRoot ? abs.toLowerCase() : abs;
  const r = winRoot ? root.toLowerCase() : root;
  if (a === r) return { ok: true, outside: false, rel: ".", ci: winRoot };
  if (a.startsWith(`${r}/`)) return { ok: true, outside: false, rel: abs.slice(root.length + 1), ci: winRoot };
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
