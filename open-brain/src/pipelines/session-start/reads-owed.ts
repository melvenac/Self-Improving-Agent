import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Seat, State } from "../../shared/state-schema.js";
import { ownHandoff, questionText, watchText } from "../../shared/state-schema.js";
import { latestBriefPath } from "./latest-brief.js";

const MD_PATH_RE = /(?:docs|\.agents)\/[A-Za-z0-9._/-]+\.md\b/g;

function commitDate(projectRoot: string, relPath: string): string | null {
  const gitPath = relPath.replace(/\\/g, "/");
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", gitPath], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}

function prevSessionDate(state: State, sessionNumber: number | null, checkout: string | null | undefined): string | null {
  if (sessionNumber === null || checkout == null) return null;
  let best: string | null = null;
  for (const row of state.sessions) {
    if (row.checkout !== checkout || row.n >= sessionNumber) continue;
    if (best === null || row.date > best) best = row.date;
  }
  return best;
}

function owedByDate(commit: string | null, prevDate: string | null): boolean {
  if (prevDate === null) return true;
  if (commit === null) return false;
  return commit >= prevDate;
}

function collectHandoffPaths(state: State, seat: Seat | null, checkout: string | null | undefined): string[] {
  const own = ownHandoff(state.handoffs, seat, checkout ?? undefined);
  if (!own) return [];
  const texts = [own.pick_up, ...own.watch_out.map(watchText), ...own.open_questions.map(questionText)];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    MD_PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MD_PATH_RE.exec(text)) !== null) {
      const p = m[0];
      if (!seen.has(p)) {
        seen.add(p);
        found.push(p);
      }
    }
  }
  return found;
}

export function describeReadsOwed(
  projectRoot: string,
  state: State,
  sessionNumber: number | null,
  seat: Seat | null,
  checkout: string | null | undefined,
): string {
  const prevDate = prevSessionDate(state, sessionNumber, checkout);
  const paths: string[] = [];
  const seen = new Set<string>();

  const absFromRel = (rel: string): string => join(projectRoot, ...rel.split("/"));

  const add = (rel: string) => {
    if (seen.has(rel)) return;
    if (!existsSync(absFromRel(rel))) return;
    seen.add(rel);
    paths.push(rel);
  };

  const brief = latestBriefPath(projectRoot);
  if (brief !== null && owedByDate(brief.date.slice(0, 10), prevDate)) add(brief.path);

  for (const p of collectHandoffPaths(state, seat, checkout)) {
    if (!owedByDate(commitDate(projectRoot, p), prevDate)) continue;
    add(p);
  }

  for (const rel of [".agents/AGENT.md", ".agents/AGENT.local.md", ".agents/SYSTEM/domains.json"]) {
    if (!owedByDate(commitDate(projectRoot, rel), prevDate)) continue;
    add(rel);
  }

  if (paths.length === 0) return "READS OWED: none";
  const shown = paths.slice(0, 6);
  const rest = paths.length - shown.length;
  const tail = rest > 0 ? ` · +${rest} more` : "";
  return `READS OWED (${paths.length}): ${shown.join(" · ")}${tail}`;
}
