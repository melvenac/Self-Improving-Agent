/**
 * T-295 S2 (Aaron, 2026-10-26: "Cut 14 to 10"): what the `ob_list` and `ob_stats` MCP tools printed, now the CLI's
 * `open-brain list` and `open-brain stats` (cli-memory.ts). The bodies moved here from server.ts unchanged except for
 * their returns, the database path, which is the caller's, and the schema line, read from the database instead of the
 * server's cached skew. Memory side: `pipelines/store/` is in MEMORY_SIDE.
 */
import { statSync } from "node:fs";
import type Database from "better-sqlite3";
import { checkSchemaSkew } from "../../db-v2.js";
import { canonicalizeProjectDir, projectIdentity } from "../../shared/paths.js";

/** The newest `limit` live entries; with `project`, only global entries and that repository's. */
export function knowledgeListText(v2db: Database.Database, limit: number, project?: string): string {
  const normalizedProject = project && canonicalizeProjectDir(project) ? projectIdentity(project) : null;

  let sql = "SELECT id, key, content, tags, source, project_dir, created_at, maturity FROM knowledge_index WHERE archived_into IS NULL";
  const params: unknown[] = [];
  if (normalizedProject) {
    sql += " AND (project_dir IS NULL OR project_dir LIKE ?)";
    params.push(`%${normalizedProject}%`);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const entries = v2db.prepare(sql).all(...params) as Array<{
    id: number; key: string | null; content: string; tags: string | null;
    source: string; project_dir: string | null; created_at: string;
    maturity: string;
  }>;

  if (entries.length === 0) {
    return "No stored knowledge entries yet.";
  }

  const lines = ["## Stored Knowledge", ""];
  for (const e of entries) {
    const scopeLabel = e.project_dir ? `[project]` : `[global]`;
    lines.push(`**[${e.id}]** ${scopeLabel} ${e.key ? `\`${e.key}\` — ` : ""}${e.content.length > 120 ? e.content.substring(0, 120) + "..." : e.content}`);
    if (e.tags) lines.push(`  Tags: ${e.tags}`);
    lines.push(`  Source: ${e.source} | Created: ${e.created_at}${e.project_dir ? ` | Project: ${e.project_dir}` : ""}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Counts and censuses over the store at `dbPath`. */
export function knowledgeStatsText(v2db: Database.Database, dbPath: string): string {
  const skew = checkSchemaSkew(v2db);
  const knowledge = v2db.prepare("SELECT COUNT(*) as c FROM knowledge_index WHERE archived_into IS NULL").get() as { c: number };
  const maturityDist = v2db.prepare(
    "SELECT COALESCE(maturity, 'progenitor') as maturity, COUNT(*) as count FROM knowledge_index WHERE archived_into IS NULL GROUP BY maturity ORDER BY count DESC"
  ).all() as Array<{ maturity: string; count: number }>;

  const rated = v2db.prepare(
    "SELECT COUNT(*) as c FROM knowledge_index WHERE (helpful + harmful + neutral) > 0 AND archived_into IS NULL"
  ).get() as { c: number };

  let dbSize = 0;
  try { dbSize = statSync(dbPath).size; } catch { /* ignore */ }

  // The recall corpus states its own labeling quality before anyone analyzes
  // it: 'unspecified' counts callers that omitted the trigger (a labeling
  // gap, not a treatment), '(pre-column)' counts rows older than v0.18.0.
  const triggerCensus = v2db.prepare(
    "SELECT COALESCE(recall_trigger, '(pre-column)') as t, COUNT(*) as count FROM recall_log GROUP BY t ORDER BY count DESC"
  ).all() as Array<{ t: string; count: number }>;

  // The trigger's three states, across every session (Loop 16 R16, A8).
  //
  // This is the denominator the memory half never had. 'not-asked' says how
  // narrow the derivation is, 'silent' says whether the floor is set
  // sensibly, 'injected' says how often anything actually reached a seat —
  // and the difference between the first two is the distinction `ob_recalled`
  // could not make for five loops (G-039). Zero rows is itself an answer
  // here and is printed as three zeros rather than an omitted section: an
  // absent census reads as "not measured", which is the failure this table
  // exists to end.
  const fireCensus = v2db.prepare(
    "SELECT state, COUNT(*) as count FROM trigger_fires GROUP BY state ORDER BY count DESC"
  ).all() as Array<{ state: string; count: number }>;
  const fireCounts: Record<string, number> = { "not-asked": 0, silent: 0, injected: 0 };
  for (const row of fireCensus) fireCounts[row.state] = row.count;

  // Same contract for ratings: where each rated id came from, with the
  // pre-column era its own bucket rather than a healthy-looking zero.
  const originCensus = v2db.prepare(
    "SELECT COALESCE(rating_origin, '(pre-column)') as o, COUNT(*) as count FROM feedback_log GROUP BY o ORDER BY count DESC"
  ).all() as Array<{ o: string; count: number }>;

  // Which ARM produced each rating, crossed with the verdict. This is the
  // census the lifecycle work is blocked on. The `heuristic` arm that would
  // have skewed it was CUT in Loop 12 (R-010) having never written a row, so
  // every row here came from a judgment rather than a topic-mention detector. Crossed rather than
  // summed because the interesting cell is `supplied` x `harmful` (the
  // apoptosis threshold it once fed is cut).
  const methodCensus = v2db.prepare(
    `SELECT COALESCE(rating_method, '(pre-column)') as m, rating as r, COUNT(*) as count
     FROM feedback_log GROUP BY m, r ORDER BY m, r`
  ).all() as Array<{ m: string; r: string; count: number }>;

  const lines = [
    `## Knowledge Stats`,
    `Total entries: ${knowledge.c}`,
    `Rated entries: ${rated.c}`,
    `Database: ${dbPath} (${(dbSize / 1024).toFixed(0)} KB)`,
    ``,
    `Maturity distribution:`,
    ...maturityDist.map(m => `  ${m.maturity}: ${m.count}`),
    ``,
    `Recall trigger census:`,
    ...triggerCensus.map(r => `  ${r.t}: ${r.count}`),
    ``,
    `Trigger fires (every invocation, whether or not it surfaced anything):`,
    `  not asked (no recognised element): ${fireCounts["not-asked"]}`,
    `  asked, silent (nothing cleared the floor): ${fireCounts.silent}`,
    `  asked, injected: ${fireCounts.injected}`,
    ``,
    `Rating origin census:`,
    ...originCensus.map(r => `  ${r.o}: ${r.count}`),
    ``,
    `Rating method x verdict:`,
    ...methodCensus.map(r => `  ${r.m} / ${r.r}: ${r.count}`),
    `  (the heuristic arm was cut in Loop 12 and never wrote a row; NULL means pre-column)`,
    ``,
    // Unconditional, including at zero — a line that only appears when
    // something went wrong reads identically to a healthy silence. The server's
    // session-proof line stays with the server (ob_set_session reports it): a
    // CLI run has no server instance to prove.
    `Schema: code v${skew.codeVersion}, database v${skew.dbVersion}${skew.writerIsStale ? " — STALE WRITER" : ""}`,
  ];

  // Loop 10 C2 (E18): the apoptosis review queue is gone with the gate that fed
  // it. It listed entries that had crossed a threshold on `success_rate` — a
  // rate that excluded neutral, and so read 1.0 for almost everything. Loop 9
  // measured the resulting penalty firing on 2 entries out of 554.

  return lines.join("\n");
}
