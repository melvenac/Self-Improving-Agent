import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { scanForSkills, type ExperienceFile } from "./skill-scan.js";
import { obsidianVaultDir } from "../../shared/paths.js";
import { parseSkillDomains } from "../../shared/skill-index.js";
import type { SkillCluster } from "./types.js";

// ─── Paths ──────────────────────────────────────────────────────────────────
//
// Resolved per call, not once at import. These were module-level consts, which
// froze the vault location before a caller could set OPEN_BRAIN_VAULT_DIR — so
// the test suite wrote SKILL-CANDIDATES.md into the real vault on every run.
// Reading the env at use time is what makes the override actually work.

const vaultPath = () => obsidianVaultDir();
const experiencesDir = () => join(vaultPath(), "Experiences");
const candidatesFile = () => join(vaultPath(), "Skill-Candidates", "SKILL-CANDIDATES.md");
const skillIndexFile = () => join(vaultPath(), "Skill-Candidates", "SKILL-INDEX.md");
const pendingFile = () => join(vaultPath(), ".skill-proposals-pending.json");
const ledgerFile = () => join(vaultPath(), ".skill-proposals-ledger.json");

/** The vault is a user-managed directory; Skill-Candidates/ may not exist yet. */
function writeVaultFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

/**
 * Collect experience notes recursively.
 *
 * v1 kept every experience flat in Experiences/; v2 files them under a project
 * subdirectory (Experiences/General/, Experiences/A2A-Hub/, …). A flat readdir
 * saw 1 of 399 notes and reported zero clusters — a silent no-op, since an empty
 * scan is indistinguishable from "nothing worth clustering".
 *
 * Names stay basenames: they become [[wikilinks]], which Obsidian resolves by
 * basename regardless of folder depth.
 */
function collectExperiences(dir: string): ExperienceFile[] {
  const out: ExperienceFile[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectExperiences(full));
    } else if (entry.name.endsWith(".md")) {
      try {
        out.push({ name: entry.name.replace(/\.md$/, ""), content: readFileSync(full, "utf8") });
      } catch { /* skip unreadable */ }
    }
  }
  return out;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Proposal ledger ────────────────────────────────────────────────────────
//
// A declined proposal used to leave no trace: the cluster still existed, so the
// next scan proposed it again, forever. The ledger records the decision, and the
// scan enforces it — the reviewing agent writes one JSON entry once, and no
// amount of re-scanning can resurrect the proposal. Keyed by lowercased tag:
//
//   { "browser-automation": { "decision": "rejected", "date": "2026-08-31",
//     "atCount": 4, "reason": "too tool-specific" } }

interface LedgerEntry {
  decision?: string;
  date?: string;
  atCount?: number;
  reason?: string;
}

/** A proposal awaiting review in .skill-proposals-pending.json. */
interface PendingProposal {
  tag: string;
  count: number;
  files: string[];
  date: string;
}

function readLedger(): Record<string, LedgerEntry> {
  try {
    const parsed = JSON.parse(readFileSync(ledgerFile(), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * A rejection is scoped to the evidence it judged: rejected at `atCount`
 * experiences, the cluster stays suppressed until it outgrows that count —
 * new experiences are new evidence and earn a fresh review. An entry without
 * `atCount` is an unconditional rejection.
 */
function isRejected(tag: string, count: number, ledger: Record<string, LedgerEntry>): boolean {
  const entry = ledger[tag.toLowerCase()];
  if (!entry || entry.decision !== "rejected") return false;
  return typeof entry.atCount === "number" ? count <= entry.atCount : true;
}

function readPending(): PendingProposal[] {
  try {
    const parsed = JSON.parse(readFileSync(pendingFile(), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePreviousCounts(content: string): { counts: Map<string, number>; previousDate: string | null } {
  const counts = new Map<string, number>();
  const dateMatch = content.match(/date:\s*(\S+)/);
  const previousDate = dateMatch ? dateMatch[1] : null;
  const clusterRegex = /###\s+(\S+)\s+\((\d+)\s+experiences?\)/g;
  let match;
  while ((match = clusterRegex.exec(content)) !== null) {
    counts.set(match[1], parseInt(match[2]));
  }
  return { counts, previousDate };
}

// ─── Runner ─────────────────────────────────────────────────────────────────

export interface SkillScanPipelineResult {
  clusters: number;
  pendingProposals: number;
  approaching: number;
}

/**
 * Full skill-scan pipeline: read experiences from vault, run scan, write SKILL-CANDIDATES.md.
 */
export function runSkillScanPipeline(): SkillScanPipelineResult {
  if (!existsSync(experiencesDir())) {
    return { clusters: 0, pendingProposals: 0, approaching: 0 };
  }

  const experienceFiles = collectExperiences(experiencesDir());

  // Read previous scan state
  let previousCounts = new Map<string, number>();
  let previousDate: string | null = null;
  if (existsSync(candidatesFile())) {
    try {
      const parsed = parsePreviousCounts(readFileSync(candidatesFile(), "utf8"));
      previousCounts = parsed.counts;
      previousDate = parsed.previousDate;
    } catch { /* ignore */ }
  }

  // Read existing skills
  let existingSkills = new Set<string>();
  if (existsSync(skillIndexFile())) {
    try {
      existingSkills = parseSkillDomains(readFileSync(skillIndexFile(), "utf8"));
    } catch { /* ignore */ }
  }

  // Run the scan
  const result = scanForSkills(experienceFiles, previousCounts);

  const ledger = readLedger();
  const rejected = new Set(
    result.clusters.filter((c) => isRejected(c.tag, c.count, ledger)).map((c) => c.tag),
  );

  // Write SKILL-CANDIDATES.md
  writeCandidatesFile(result.clusters, previousCounts, previousDate, existingSkills, rejected);

  // Rebuild the pending marker rather than append-or-skip. The old write fired
  // only when a scan found something new, so a marker written once was never
  // cleared: proposals stayed "pending" after being rejected or graduating, and
  // startup re-reported them every session. Rebuilding from current clusters
  // makes the marker self-healing — a proposal survives exactly as long as its
  // cluster does and no decision has been recorded against it.
  const prior = new Map(readPending().map((p) => [p.tag?.toLowerCase(), p]));
  const pending: PendingProposal[] = [];
  for (const c of result.clusters) {
    if (c.oversized) continue;
    const key = c.tag.toLowerCase();
    if (existingSkills.has(key)) continue;
    if (rejected.has(c.tag)) continue;
    if (c.status === "new" || prior.has(key)) {
      pending.push({ tag: c.tag, count: c.count, files: c.files, date: prior.get(key)?.date ?? today() });
    }
  }
  writeVaultFile(pendingFile(), JSON.stringify(pending, null, 2));

  return {
    clusters: result.clusters.length,
    pendingProposals: pending.length,
    approaching: result.approaching,
  };
}

function writeCandidatesFile(
  clusters: SkillCluster[],
  previousCounts: Map<string, number>,
  previousDate: string | null,
  existingSkills: Set<string>,
  rejected: Set<string> = new Set(),
): void {
  let md = `---\ndate: ${today()}\ntype: skill-scan\nprevious-scan: ${previousDate || "none"}\n---\n\n`;
  md += `# Skill Candidates\n\n`;
  md += `> Auto-generated by open-brain skill-scan on ${today()}.\n`;
  md += `> Clusters of 3+ experiences suggest a reusable skill could be distilled.\n\n`;
  md += `## By Tag\n\n`;

  for (const cluster of clusters) {
    const hasSkill = existingSkills.has(cluster.tag.toLowerCase());
    const isRejected = rejected.has(cluster.tag);
    const status: string[] = [];
    if (hasSkill) status.push("has skill");
    if (cluster.oversized) status.push("TOO LARGE");
    else if (isRejected) status.push("rejected");
    else if (cluster.status === "new") status.push("NEW");
    if (cluster.status === "growing") status.push("growing");
    if (cluster.consolidatedFrom?.length) status.push(`merged: ${cluster.consolidatedFrom.join(", ")}`);

    md += `### ${cluster.tag} (${cluster.count} experiences)${status.length ? " — " + status.join(", ") : ""}\n\n`;
    if (cluster.oversized) {
      md += `**Status:** Too broad to distil into one skill — split into narrower tags before proposing\n\n`;
    } else if (hasSkill) {
      md += `**Status:** Skill exists — consider updating if new experiences add novel patterns\n\n`;
    } else if (isRejected) {
      md += `**Status:** Proposal rejected (see .skill-proposals-ledger.json) — re-proposes if the cluster outgrows the rejected count\n\n`;
    } else {
      md += `**Potential skill:** "${cluster.tag}" patterns and gotchas\n\n`;
    }
    for (const f of cluster.files) {
      md += `- [[${f}]]\n`;
    }
    md += "\n";
  }

  if (previousDate) {
    md += `## Scan Diff (vs ${previousDate})\n\n`;
    md += `| Cluster | Previous | Current | Change |\n|---|---|---|---|\n`;
    const allTags = new Set([...previousCounts.keys(), ...clusters.map((c) => c.tag)]);
    for (const tag of [...allTags].sort()) {
      const prev = previousCounts.get(tag) ?? 0;
      const curr = clusters.find((c) => c.tag === tag)?.count ?? 0;
      if (curr < 3 && prev < 3) continue;
      const change = prev === 0 ? "NEW" : curr === prev ? "unchanged" : `+${curr - prev}`;
      md += `| ${tag} | ${prev || "—"} | ${curr} | ${change} |\n`;
    }
    md += "\n";
  }

  md += `---\n\n*Last scan: ${today()}. Runs automatically at session end via open-brain pipeline.*\n`;

  writeVaultFile(candidatesFile(), md);
}
