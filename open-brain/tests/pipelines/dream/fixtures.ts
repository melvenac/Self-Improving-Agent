import type { KnowledgeIndexRow } from "../../../src/db-v2.js";

/**
 * A `knowledge_index` row with every column filled, so a test names only the
 * fields it is actually about.
 *
 * `rules.test.ts` and `obsolete.test.ts` predate this and carry their own copies
 * with different `created_at` defaults that their assertions depend on — the
 * stale tests in particular are sensitive to it. They are left alone rather than
 * migrated: consolidating them would mean re-tuning passing tests to suit a
 * helper, which is the wrong direction.
 */
export function entry(over: Partial<KnowledgeIndexRow> & { id: number }): KnowledgeIndexRow {
  return {
    vault_path: `Experiences/General/entry-${over.id}.md`,
    key: `entry-${over.id}`,
    content: "some content",
    tags: "",
    source: "manual",
    project_dir: null,
    maturity: "progenitor",
    helpful: 0,
    harmful: 0,
    neutral: 0,
    success_rate: null,
    recall_count: 0,
    last_recalled_at: null,
    archived_into: null,
    fact_kind: null,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    ...over,
  };
}
