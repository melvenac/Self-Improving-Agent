import { normalize, posix } from "node:path";

/** Normalise a repo-relative path to forward slashes, no leading ./ */
export function normalizeRelPath(raw: string): string {
  const n = posix.normalize(raw.replace(/\\/g, "/")).replace(/^\.\//, "");
  return n.startsWith("../") ? n : n;
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
