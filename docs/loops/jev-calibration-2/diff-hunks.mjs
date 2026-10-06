// Deterministic unified-diff parsing and per–requirement-row hunk assignment (calibration 2 SIZE).

/** @typedef {{ path: string; text: string }} FileDiff */

export function splitUnifiedDiff(diff) {
  if (!diff?.trim()) return [];
  const lines = diff.split("\n");
  const files = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith("diff --git ")) {
      i += 1;
      continue;
    }
    const header = lines[i];
    const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(header);
    const path = m ? m[2] : header.slice("diff --git ".length).split(" ")[0]?.replace(/^b\//, "") ?? "unknown";
    i += 1;
    const chunk = [header];
    while (i < lines.length && !lines[i].startsWith("diff --git ")) {
      chunk.push(lines[i]);
      i += 1;
    }
    files.push({ path, text: chunk.join("\n") });
  }
  return files;
}

function rowTokens(observable) {
  const text = String(observable ?? "").toLowerCase();
  const words = text.match(/[a-z0-9_.-]{4,}/g) ?? [];
  return [...new Set(words)];
}

function fileMatchesRow(filePath, tokens) {
  const base = filePath.split("/").pop()?.toLowerCase() ?? "";
  const full = filePath.toLowerCase();
  return tokens.some((t) => base.includes(t) || full.includes(t));
}

/** Assign each plan row the diff hunks for files its observable text names; else a stable file by row id. */
export function requirementRowsWithHunks(plan, filteredDiff, diffstatPaths) {
  const files = splitUnifiedDiff(filteredDiff);
  const paths = diffstatPaths ?? files.map((f) => f.path);
  return plan.acceptance.map((row, rowIndex) => {
    const tokens = rowTokens(row.observable);
    let matched = files.filter((f) => fileMatchesRow(f.path, tokens));
    if (matched.length === 0 && files.length > 0) {
      const idx =
        [...row.id].reduce((s, c) => s + c.charCodeAt(0), 0) % files.length;
      matched = [files[idx]];
    }
    const hunks = matched.map((f) => f.text).filter(Boolean);
    if (hunks.length === 0 && paths.length > 0) {
      const p = paths[rowIndex % paths.length];
      const f = files.find((x) => x.path === p);
      if (f) hunks.push(f.text);
    }
    return { id: row.id, observable: row.observable, hunks };
  });
}

/** Truncate a diff text from the end, keeping file headers and early hunks. */
export function trimDiffText(text, maxChars) {
  if (text.length <= maxChars) return text;
  const lines = text.split("\n");
  const out = [];
  let len = 0;
  for (const line of lines) {
    const need = len === 0 ? line.length : line.length + 1;
    if (len + need > maxChars) break;
    out.push(line);
    len += need;
  }
  if (out.length === 0) return text.slice(0, maxChars);
  return `${out.join("\n")}\n…[cal2 diff truncated]`;
}

export function trimRequirementRows(rows, perRowCharBudget) {
  return rows.map((row) => ({
    ...row,
    hunks: row.hunks.map((h) => trimDiffText(h, perRowCharBudget)),
  }));
}
