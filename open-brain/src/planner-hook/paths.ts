import { normalize, posix } from "node:path";

/** Normalise a repo-relative path to forward slashes, no leading ./ */
export function normalizeRelPath(raw: string): string {
  const n = posix.normalize(raw.replace(/\\/g, "/")).replace(/^\.\//, "");
  return n.startsWith("../") ? n : n;
}

export type RepoRelative = { ok: true; rel: string } | { ok: false; cause: string };

const WIN_DRIVE_RE = /^[A-Za-z]:\//;

/**
 * T-194 r3 (D1): Claude Code's Edit/Write send ABSOLUTE paths, so every target is made relative
 * to the repo root before the PH-1/PH-2 prefix checks. Accepts both slash forms and, when the
 * root is a Windows path, Git Bash's `/c/...` form. An absolute path outside the root, or a
 * relative one that climbs out of it, cannot be made relative and is refused with a named cause.
 */
export function toRepoRelative(raw: string, repoRoot: string): RepoRelative {
  let p = raw.trim().replace(/\\/g, "/");
  const root = posix.normalize(repoRoot.replace(/\\/g, "/")).replace(/\/+$/, "");
  const winRoot = WIN_DRIVE_RE.test(root);
  if (winRoot) {
    const bash = p.match(/^\/([A-Za-z])(\/.*)?$/);
    if (bash) p = `${bash[1]}:${bash[2] ?? "/"}`;
  }
  if (!p.startsWith("/") && !WIN_DRIVE_RE.test(p)) {
    const n = posix.normalize(p).replace(/^\.\//, "");
    if (n === ".." || n.startsWith("../")) {
      return { ok: false, cause: `${raw} climbs out of the repository (${repoRoot}), so it cannot be made repo-relative` };
    }
    return { ok: true, rel: n };
  }
  const abs = posix.normalize(p);
  const a = winRoot ? abs.toLowerCase() : abs;
  const r = winRoot ? root.toLowerCase() : root;
  if (a === r) return { ok: true, rel: "." };
  if (a.startsWith(`${r}/`)) return { ok: true, rel: abs.slice(root.length + 1) };
  return { ok: false, cause: `${raw} is outside the repository (${repoRoot}), so it cannot be made repo-relative` };
}

const ARTIFACT_PREFIXES = [
  "open-brain/src/",
  "open-brain/tests/",
  "scripts/",
  "open-brain/build/",
  "hooks/",
];

/** PH-1: source, tests, hooks, scripts, build output, package.json */
export function isProtectedArtifactPath(raw: string): boolean {
  const p = normalizeRelPath(raw);
  if (p === "package.json" || p.endsWith("/package.json")) return true;
  return ARTIFACT_PREFIXES.some((pref) => p === pref.slice(0, -1) || p.startsWith(pref));
}

const RENDERED_VIEW_PATHS = new Set([
  ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md",
  ".agents/SESSIONS/next-session.md",
  ".agents/state.json",
]);

export const SUMMARY_PATH = ".agents/SYSTEM/SUMMARY.md";

/** PH-2: rendered views and state.json (SUMMARY handled separately). */
export function isRenderedViewPath(raw: string): boolean {
  return RENDERED_VIEW_PATHS.has(normalizeRelPath(raw));
}

/** PH-4: planner may write loop briefs here without a grant. */
export function isAllowedDocsLoopsPath(raw: string): boolean {
  const p = normalizeRelPath(raw);
  return p === "docs/loops" || p.startsWith("docs/loops/");
}
