/** Paths excluded from the work diff Jev sees (calibration record, not the change under review). */

export function isRecordDiffPath(filePath) {
  const p = filePath.replace(/\\/g, "/").replace(/^\//, "");
  if (p === "CHANGELOG.md") return true;
  if (p === ".agents/state.json") return true;
  if (p === ".agents/TASKS/INBOX.md" || p === ".agents/TASKS/task.md") return true;
  if (p === ".agents/SESSIONS/next-session.md") return true;
  if (p === ".agents/SYSTEM/SUMMARY.md") return true;
  if (p.startsWith("docs/loops/")) return true;
  return false;
}

/** Drop unified-diff hunks whose path is a record path; return excluded paths for the input file. */
export function filterUnifiedDiff(diff) {
  if (!diff.trim()) return { diff: "", excluded_paths: [] };
  const chunks = diff.split(/(?=^diff --git )/m);
  const kept = [];
  const excluded = new Set();
  for (const chunk of chunks) {
    if (!chunk.startsWith("diff --git ")) {
      if (chunk) kept.push(chunk);
      continue;
    }
    const m = chunk.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const path = m?.[2] ?? "";
    if (path && isRecordDiffPath(path)) {
      excluded.add(path);
      continue;
    }
    kept.push(chunk);
  }
  return { diff: kept.join(""), excluded_paths: [...excluded].sort() };
}

export function filterPathList(paths) {
  const excluded_paths = [];
  const kept = [];
  for (const p of paths) {
    if (isRecordDiffPath(p)) excluded_paths.push(p);
    else kept.push(p);
  }
  excluded_paths.sort();
  return { paths: kept, excluded_paths };
}
