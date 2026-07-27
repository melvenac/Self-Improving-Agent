import type { SkillCluster, SkillScanResult } from "./types.js";

export interface ExperienceFile {
  name: string;
  content: string;
}

const NOISE_TAGS = new Set(["test", "marker", "gotcha", "pattern", "fix", "optimization", "debug"]);

/** A merged cluster larger than this is not reviewable as a single skill. */
const MAX_CLUSTER_SIZE = 8;

/** Share of a cluster's files that must appear in a larger one to call it a duplicate. */
const DUPLICATE_CONTAINMENT = 0.75;

/**
 * Parse YAML frontmatter for `tags` and `domain` fields.
 * Handles both inline array and YAML list syntax.
 */
export function parseExperienceTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const fm = fmMatch[1];
  const tags: string[] = [];

  function parseField(fieldName: string): void {
    // Inline array: tags: [a, b, c]
    const inlineMatch = fm.match(new RegExp(`^${fieldName}:\\s*\\[([^\\]]+)\\]`, "m"));
    if (inlineMatch) {
      const items = inlineMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      tags.push(...items);
      return;
    }

    // YAML list:
    // tags:
    //   - a
    //   - b
    const listMatch = fm.match(new RegExp(`^${fieldName}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, "m"));
    if (listMatch) {
      const items = listMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s+-\s+/, "").trim())
        .filter(Boolean);
      tags.push(...items);
      return;
    }

    // Scalar value: domain: some-value
    const scalarMatch = fm.match(new RegExp(`^${fieldName}:\\s+(\\S+)`, "m"));
    if (scalarMatch) {
      tags.push(scalarMatch[1].trim());
    }
  }

  parseField("tags");
  parseField("domain");

  // Strip YAML quoting, filter noise, deduplicate.
  // Quoted and bare forms of the same tag are the same tag — leaving the quotes
  // on splits every tag into two clusters and lets quoted noise tags through.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/^["']|["']$/g, "").trim();
    if (!tag || NOISE_TAGS.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

/**
 * Group filenames by shared tags.
 */
export function clusterByTag(files: { name: string; tags: string[] }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const file of files) {
    for (const tag of file.tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(file.name);
    }
  }
  return map;
}

/**
 * Detect cluster status changes relative to previous counts.
 * Only returns clusters at or above threshold.
 */
export function detectChanges(
  current: Map<string, string[]>,
  previous: Map<string, number>,
  threshold: number = 3
): SkillCluster[] {
  const result: SkillCluster[] = [];
  for (const [tag, files] of current) {
    const count = files.length;
    if (count < threshold) continue;

    const prevCount = previous.get(tag);
    let status: SkillCluster["status"];
    if (prevCount === undefined) {
      status = "new";
    } else if (count > prevCount) {
      status = "growing";
    } else {
      status = "stable";
    }

    result.push({ tag, count, files, status });
  }
  return result;
}

/**
 * Merge clusters with file overlap above overlapThreshold.
 * Overlap ratio = Jaccard = intersection / union.
 *
 * Normalizing by the smaller set instead measures containment, not similarity:
 * any small cluster fully inside a large one scores 1.0 and merges
 * unconditionally, so one seed cluster snowballs through the whole vault.
 *
 * Merges whose result would exceed maxClusterSize are refused — a "skill"
 * distilled from that many experiences is not reviewable.
 */
export function consolidateClusters(
  clusters: SkillCluster[],
  overlapThreshold: number = 0.6,
  maxClusterSize: number = MAX_CLUSTER_SIZE
): SkillCluster[] {
  // Work on a copy; track which indices have been absorbed.
  // `members` records each contributing tag alongside the size of its original
  // file set, so a merged cluster can be named after the tag covering the
  // largest share rather than whichever tag happened to come first.
  const active = clusters.map((c) => ({
    ...c,
    files: [...c.files],
    consolidatedFrom: c.consolidatedFrom ? [...c.consolidatedFrom] : undefined,
    members: [{ tag: c.tag, size: c.files.length }],
  }));
  const absorbed = new Set<number>();

  for (let i = 0; i < active.length; i++) {
    if (absorbed.has(i)) continue;
    for (let j = i + 1; j < active.length; j++) {
      if (absorbed.has(j)) continue;

      const setA = new Set(active[i].files);
      const intersection = active[j].files.filter((f) => setA.has(f));
      const mergedSize = new Set([...active[i].files, ...active[j].files]).size;
      const ratio = intersection.length / mergedSize;

      if (ratio <= overlapThreshold) continue;
      if (mergedSize > maxClusterSize) continue;

      // Primary (i) absorbs secondary (j): add unique files from j into i
      const uniqueFromJ = active[j].files.filter((f) => !setA.has(f));
      active[i].files.push(...uniqueFromJ);
      active[i].count = active[i].files.length;
      active[i].members.push(...active[j].members);

      absorbed.add(j);
    }
  }

  const result: SkillCluster[] = [];
  for (let i = 0; i < active.length; i++) {
    if (absorbed.has(i)) continue;
    const { members, ...cluster } = active[i];
    if (members.length > 1) {
      // Name by dominant member — the tag covering the largest share of the
      // merged file set. Ties keep the earlier tag.
      const ranked = members
        .map((m, idx) => ({ ...m, idx }))
        .sort((a, b) => b.size - a.size || a.idx - b.idx);
      cluster.tag = ranked[0].tag;
      cluster.consolidatedFrom = ranked.slice(1).map((m) => m.tag);
    }
    result.push(cluster);
  }
  return result;
}

/**
 * Drop clusters that are near-duplicates of a larger one: if at least
 * containmentThreshold of cluster X's files also appear in cluster Y, and Y is
 * at least as large, only Y is proposed.
 *
 * Consolidation deliberately leaves these alone (their Jaccard overlap is low),
 * but proposing both spends two review cycles on the same material.
 */
export function dedupeClusters(
  clusters: SkillCluster[],
  containmentThreshold: number = DUPLICATE_CONTAINMENT
): SkillCluster[] {
  const dropped = new Set<number>();

  for (let i = 0; i < clusters.length; i++) {
    if (dropped.has(i) || clusters[i].files.length === 0) continue;
    for (let j = 0; j < clusters.length; j++) {
      if (i === j || dropped.has(j)) continue;

      // Keep the larger cluster; ties keep the earlier one.
      const sizeI = clusters[i].files.length;
      const sizeJ = clusters[j].files.length;
      if (sizeJ < sizeI || (sizeJ === sizeI && j > i)) continue;

      const setJ = new Set(clusters[j].files);
      const shared = clusters[i].files.filter((f) => setJ.has(f)).length;
      if (shared / sizeI >= containmentThreshold) {
        dropped.add(i);
        break;
      }
    }
  }

  return clusters.filter((_, idx) => !dropped.has(idx));
}

/**
 * Full pipeline: parse → cluster → detect approaching → detect changes → consolidate.
 */
export function scanForSkills(
  experienceFiles: ExperienceFile[],
  previousCounts: Map<string, number>,
  threshold: number = 3
): SkillScanResult {
  if (experienceFiles.length === 0) {
    return { clusters: [], pendingProposals: 0, approaching: 0 };
  }

  // Parse tags from each file
  const tagged = experienceFiles.map((f) => ({
    name: f.name,
    tags: parseExperienceTags(f.content),
  }));

  // Cluster by tag
  const tagMap = clusterByTag(tagged);

  // Count approaching (threshold-1 = 2 files)
  const approachingThreshold = threshold - 1;
  let approaching = 0;
  for (const files of tagMap.values()) {
    if (files.length === approachingThreshold) approaching++;
  }

  // Detect changes at or above threshold
  const clusters = detectChanges(tagMap, previousCounts, threshold);

  // Consolidate overlapping clusters, then drop near-duplicate proposals
  const consolidated = dedupeClusters(consolidateClusters(clusters));

  // Flag clusters too large to review as a single skill. A broad tag like
  // `deployment` accumulates dozens of unrelated experiences; proposing it
  // wastes a review cycle every scan. It needs splitting first.
  for (const cluster of consolidated) {
    if (cluster.count > MAX_CLUSTER_SIZE) cluster.oversized = true;
  }

  // Count pending proposals (new or growing, and actually reviewable)
  const pendingProposals = consolidated.filter(
    (c) => !c.oversized && (c.status === "new" || c.status === "growing")
  ).length;

  return { clusters: consolidated, pendingProposals, approaching };
}
