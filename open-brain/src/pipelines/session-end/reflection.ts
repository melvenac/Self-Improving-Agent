import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import { getClusterCandidates } from "../../db-v2.js";

export interface ReflectionCluster {
  tag: string;
  count: number;
}

export interface FlagReflectionResult {
  flagged: number;
  clusters: ReflectionCluster[];
}

interface ReflectionLogRow {
  cluster_tag: string;
  result: string;
  created_at: string;
}

const REJECTION_WINDOW_DAYS = 30;

export function flagReflectionClusters(
  db: Database.Database,
  queuePath: string
): FlagReflectionResult {
  // 1. Get all tags with 3+ entries
  const candidates = getClusterCandidates(db);

  if (candidates.length === 0) {
    return { flagged: 0, clusters: [] };
  }

  // 2. Load reflection_log entries for these tags
  const tags = candidates.map((c) => c.tag);
  const placeholders = tags.map(() => "?").join(", ");
  const logRows = db
    .prepare(
      `SELECT cluster_tag, result, created_at FROM reflection_log WHERE cluster_tag IN (${placeholders})`
    )
    .all(...tags) as ReflectionLogRow[];

  const now = new Date();
  const cutoff = new Date(now.getTime() - REJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Build sets for fast lookup
  const approvedTags = new Set<string>();
  const recentlyRejectedTags = new Set<string>();

  for (const row of logRows) {
    if (row.result === "approved") {
      approvedTags.add(row.cluster_tag);
    } else if (row.result === "rejected") {
      const rowDate = new Date(row.created_at);
      if (rowDate >= cutoff) {
        recentlyRejectedTags.add(row.cluster_tag);
      }
    }
  }

  // 3. Filter candidates
  const eligible = candidates.filter(
    (c) => !approvedTags.has(c.tag) && !recentlyRejectedTags.has(c.tag)
  );

  if (eligible.length === 0) {
    return { flagged: 0, clusters: [] };
  }

  // 4. Write queue file
  const queue = {
    created_at: now.toISOString(),
    clusters: eligible.map((c) => ({ tag: c.tag, count: c.count })),
  };

  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");

  return { flagged: eligible.length, clusters: eligible };
}
