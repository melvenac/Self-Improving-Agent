#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  recall,
  getStats,
  pruneExpired,
  getKnowledgeDb,
  insertKnowledge,
  deleteKnowledge,
  listKnowledge,
  insertSummary,
  getUnsummarizedSessionIds,
  getSessionChunks,
  insertChunk,
  insertTags,
  getKnowledgeById,
  recordFeedback,
  getRecalledKnowledgeIds,
  clearRecalledKnowledgeIds,
  deleteKnowledgeById,
  setActiveSession,
  getActiveSession,
  deleteChunk,
  findSimilarityClusters,
  getStaleKnowledge,
  archiveKnowledge,
  inheritFeedbackCounts,
  findSimilarKnowledge,
} from "./db.js";
import { evaluateLifecycle, type Rating, type FeedbackEntry } from "./lifecycle.js";
import { indexSessionFile, indexAllUnindexed } from "./indexer.js";

const server = new McpServer({
  name: "open-brain-knowledge",
  version: "0.3.0",
});

// --- kb_recall: Search across all past sessions, stored knowledge, and summaries ---
server.tool(
  "kb_recall",
  "Search across all indexed sessions, stored knowledge, and session summaries. Returns ranked results. By default, results are scoped to the project you specify — always pass your current working directory as `project` for best results. Set `global: true` to search across all projects. Global knowledge (stored without a project) is always included regardless of scope.",
  {
    queries: z
      .array(z.string())
      .min(1)
      .describe("Search queries — batch all questions in one call"),
    sessions: z
      .number()
      .optional()
      .describe("Limit to last N sessions"),
    since: z
      .string()
      .optional()
      .describe("Time window, e.g. '7 days', '30 days', '2 hours'"),
    category: z
      .enum([
        "prompt",
        "tool_result",
        "file_change",
        "file_read",
        "error",
        "command_output",
        "knowledge",
        "summary",
        "other",
      ])
      .optional()
      .describe("Filter by event category"),
    project: z
      .string()
      .optional()
      .describe("Your current working directory — used to scope results to the current project"),
    global: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, search across ALL projects instead of scoping to the current one"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Filter by tags (e.g. ['typescript', 'error:enoent', 'ext:ts'])"),
    verbose: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, return full chunk content instead of just snippets"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Results per query (default: 5)"),
  },
  async ({ queries, since, category, project, global: globalSearch, tags, verbose, limit }) => {
    const results: string[] = [];

    for (const query of queries) {
      try {
        const matches = await recall(query, {
          since,
          category,
          project: globalSearch ? undefined : project,
          tags,
          limit,
          verbose,
          global: globalSearch,
        });

        results.push(`## ${query}`);
        if (matches.length === 0) {
          results.push("No results found.\n");
          continue;
        }

        for (const match of matches) {
          const typeLabel =
            match.result_type === "knowledge"
              ? "[stored knowledge]"
              : match.result_type === "summary"
                ? "[session summary]"
                : `[${match.category}]`;

          const idTag = match.id != null ? ` (id: ${match.id})` : "";
          results.push(`### ${typeLabel} ${match.source}${idTag}`);
          results.push(
            `Session: ${match.session_started} | Project: ${match.project_dir || "unknown"}`
          );

          if (verbose) {
            results.push(match.content);
          } else {
            results.push(match.snippet);
          }

          if (match.tags.length > 0) {
            results.push(`Tags: ${match.tags.join(", ")}`);
          }

          results.push("");
        }
      } catch (err) {
        results.push(`## ${query}`);
        results.push(
          `Error: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }

    return {
      content: [{ type: "text" as const, text: results.join("\n") }],
    };
  }
);

// --- kb_index: Index a specific session .db file ---
server.tool(
  "kb_index",
  "Index a specific session .db file into the persistent knowledge base. Supports incremental updates — if the session was already indexed but has new events, only the new data is processed.",
  {
    db_file: z.string().describe("Absolute path to a session .db file"),
  },
  async ({ db_file }) => {
    try {
      const result = indexSessionFile(db_file);
      return {
        content: [
          {
            type: "text" as const,
            text: `Indexed session ${result.sessionId} (${result.status}):\n- Events: ${result.eventsIndexed}\n- Chunks created: ${result.chunksCreated}\n- Tags created: ${result.tagsCreated}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error indexing ${db_file}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- kb_reindex: Index all un-indexed session files ---
server.tool(
  "kb_reindex",
  "Scan the sessions directory and index any new or updated session .db files. Incremental by default — only processes sessions with new events. Use force to rebuild everything.",
  {
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, drop and rebuild the entire knowledge base"),
  },
  async ({ force }) => {
    if (force) {
      const db = getKnowledgeDb();
      db.exec("DELETE FROM chunks");
      db.exec("DELETE FROM sessions");
      db.exec("DELETE FROM tags");
      db.exec("DELETE FROM summaries");
    }

    const result = indexAllUnindexed();

    let text = `Re-index complete:\n- New: ${result.indexed} sessions\n- Updated: ${result.updated} sessions\n- Skipped: ${result.skipped} (unchanged)`;
    if (result.errors.length > 0) {
      text += `\n- Errors: ${result.errors.length}\n  ${result.errors.join("\n  ")}`;
    }

    return {
      content: [{ type: "text" as const, text }],
    };
  }
);

// --- kb_set_session: Register the active session ID ---
server.tool(
  "kb_set_session",
  "Register the active session ID. Call once at session start. All subsequent kb_store and kb_store_chunk calls will inherit this session ID for provenance tracking.",
  {
    session_id: z.string().describe("The Claude session UUID from the active .db file"),
    project_dir: z.string().optional().describe("Current working directory — used to populate the session row's project_dir"),
  },
  async ({ session_id, project_dir }) => {
    const db = getKnowledgeDb();
    setActiveSession(session_id);

    // Ensure session row exists
    const exists = db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(session_id);
    if (!exists) {
      db.prepare(
        `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at, event_count_at_index)
         VALUES (?, '', ?, datetime('now'), NULL, 0, datetime('now'), 0)`
      ).run(session_id, project_dir || null);
    } else if (project_dir) {
      // Update project_dir if it was previously null
      db.prepare(
        `UPDATE sessions SET project_dir = ? WHERE id = ? AND project_dir IS NULL`
      ).run(project_dir, session_id);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Active session set: ${session_id}${project_dir ? ` (project: ${project_dir})` : ""}`,
        },
      ],
    };
  }
);

// --- kb_stats: Show knowledge base statistics ---
server.tool(
  "kb_stats",
  "Show statistics about the persistent knowledge base — sessions, chunks, tags, stored knowledge, summaries, and disk usage.",
  {},
  async () => {
    const stats = getStats();

    const lines = [
      "## Knowledge Base Stats",
      "",
      `| Metric | Value |`,
      `|---|---|`,
      `| Sessions indexed | ${stats.total_sessions} |`,
      `| Total chunks | ${stats.total_chunks} |`,
      `| Unique tags | ${stats.total_tags} |`,
      `| Stored knowledge | ${stats.total_knowledge} |`,
      `| Session summaries | ${stats.total_summaries} |`,
      `| Oldest session | ${stats.oldest_session || "none"} |`,
      `| Newest session | ${stats.newest_session || "none"} |`,
      `| Database size | ${(stats.db_size_bytes / 1024).toFixed(1)} KB |`,
      "",
    ];

    if (stats.sessions_by_project.length > 0) {
      lines.push("### Sessions by Project");
      for (const p of stats.sessions_by_project) {
        lines.push(`- ${p.project_dir}: ${p.count}`);
      }
      lines.push("");
    }

    if (stats.chunks_by_category.length > 0) {
      lines.push("### Chunks by Category");
      for (const c of stats.chunks_by_category) {
        lines.push(`- ${c.category}: ${c.count}`);
      }
      lines.push("");
    }

    if (stats.top_tags.length > 0) {
      lines.push("### Top Tags");
      for (const t of stats.top_tags) {
        lines.push(`- ${t.tag}: ${t.count}`);
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// --- kb_prune: Clean up expired sessions ---
server.tool(
  "kb_prune",
  "Remove sessions older than their TTL (default 90 days). Returns count of pruned sessions.",
  {},
  async () => {
    const pruned = pruneExpired();
    return {
      content: [
        {
          type: "text" as const,
          text: `Pruned ${pruned} expired session(s) from the knowledge base.`,
        },
      ],
    };
  }
);

// --- kb_store: Store arbitrary knowledge ---
server.tool(
  "kb_store",
  "Store a piece of knowledge in the brain. Use for facts, notes, preferences, or anything worth remembering permanently. By default, knowledge is stored globally (available across all projects). Set scope to 'project' and pass your working directory as project_dir to scope it to a specific project.",
  {
    content: z
      .string()
      .describe("The knowledge to store"),
    key: z
      .string()
      .optional()
      .describe("Short label for easy retrieval (e.g. 'wifi-password', 'deploy-process')"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for categorization"),
    source: z
      .string()
      .optional()
      .default("manual")
      .describe("Where this knowledge came from (e.g. 'manual', 'agent', 'import')"),
    scope: z
      .enum(["global", "project"])
      .optional()
      .default("global")
      .describe("'global' (default) = available everywhere. 'project' = scoped to a specific project directory."),
    project_dir: z
      .string()
      .optional()
      .describe("Project directory to scope this knowledge to (only used when scope is 'project')"),
    session_id: z.string().optional().describe("Session ID for provenance. Falls back to active session if omitted."),
  },
  async ({ content, key, tags, source, scope, project_dir, session_id }) => {
    const effectiveProjectDir = scope === "project" ? project_dir || null : null;

    // Storage-time dedup: check for similar existing entries
    const similar = findSimilarKnowledge(content);
    if (similar.length > 0) {
      const top = similar[0];
      // Log to dedup-review.json instead of blocking
      try {
        const { readFileSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { homedir } = await import("node:os");
        const reviewPath = join(homedir(), ".claude", "knowledge-mcp", "dedup-review.json");
        let reviews: any[] = [];
        try { reviews = JSON.parse(readFileSync(reviewPath, "utf8")); } catch { }
        reviews.push({
          date: new Date().toISOString(),
          new_key: key || null,
          new_content_preview: content.slice(0, 200),
          similar_to: { id: top.id, key: top.key, overlap: Math.round(top.overlap * 100) / 100 },
          action: "pending",
        });
        writeFileSync(reviewPath, JSON.stringify(reviews, null, 2));
      } catch { /* non-critical */ }

      // Still store the entry, but include a warning in the response
      // (propose-and-approve means we flag, not block)
    }

    const id = await insertKnowledge(content, key, tags, source, effectiveProjectDir || undefined, session_id);
    const scopeLabel = effectiveProjectDir ? ` [project: ${effectiveProjectDir}]` : " [global]";

    let responseText = `Stored knowledge entry ${id}${key ? ` (key: "${key}")` : ""}`;
    if (similar.length > 0) {
      const top = similar[0];
      responseText += `\n⚠️ Similar to existing [${top.id}] ${top.key || "(no key)"} (${Math.round(top.overlap * 100)}% overlap). Review at ~/.claude/knowledge-mcp/dedup-review.json`;
    } else {
      responseText = `Stored knowledge (id: ${id})${key ? ` with key "${key}"` : ""}${scopeLabel}${tags && tags.length > 0 ? ` — tags: ${tags.join(", ")}` : ""}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: responseText,
        },
      ],
    };
  }
);

// --- kb_forget: Remove stored knowledge ---
server.tool(
  "kb_forget",
  "Remove a piece of stored knowledge by ID or key.",
  {
    id: z
      .number()
      .optional()
      .describe("Knowledge entry ID to remove"),
    key: z
      .string()
      .optional()
      .describe("Knowledge key to remove"),
  },
  async ({ id, key }) => {
    if (!id && !key) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: provide either an id or key to delete.",
          },
        ],
        isError: true,
      };
    }

    const deleted = deleteKnowledge({ id, key });
    return {
      content: [
        {
          type: "text" as const,
          text:
            deleted > 0
              ? `Removed ${deleted} knowledge entry(ies).`
              : `No knowledge found with ${id ? `id ${id}` : `key "${key}"`}.`,
        },
      ],
    };
  }
);

// --- kb_forget_chunk: Remove a specific chunk by ID ---
server.tool(
  "kb_forget_chunk",
  "Remove a specific chunk by ID. Use for cleaning up test artifacts or unwanted chunks.",
  {
    id: z.number().describe("Chunk ID to delete"),
  },
  async ({ id }) => {
    const deleted = deleteChunk(id);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted > 0
            ? `Deleted chunk ${id}.`
            : `Chunk ${id} not found.`,
        },
      ],
    };
  }
);

// --- kb_list: List stored knowledge ---
server.tool(
  "kb_list",
  "List all manually stored knowledge entries. Pass your working directory as `project` to see only global + project-scoped entries.",
  {
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max entries to return (default: 20)"),
    project: z
      .string()
      .optional()
      .describe("Filter to global + this project's knowledge entries"),
  },
  async ({ limit, project }) => {
    const entries = listKnowledge(limit, project);

    if (entries.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "No stored knowledge entries yet." },
        ],
      };
    }

    const lines = ["## Stored Knowledge", ""];
    for (const e of entries) {
      const scopeLabel = e.project_dir ? `[project]` : `[global]`;
      lines.push(
        `**[${e.id}]** ${scopeLabel} ${e.key ? `\`${e.key}\` — ` : ""}${e.content.length > 120 ? e.content.substring(0, 120) + "..." : e.content}`
      );
      if (e.tags) lines.push(`  Tags: ${e.tags}`);
      lines.push(`  Source: ${e.source} | Created: ${e.created_at}${e.project_dir ? ` | Project: ${e.project_dir}` : ""}`);
      lines.push("");
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// --- kb_summarize: Return session data for the calling agent to summarize ---
server.tool(
  "kb_summarize",
  "Returns session chunks for the calling agent to summarize. The agent should read the chunks, write a concise summary (3-8 sentences covering what was worked on, key decisions, errors resolved, files changed, and outcome), then call kb_store_summary to save it. No API key needed — YOU are the summarizer.",
  {
    session_id: z
      .string()
      .optional()
      .describe("Summarize a specific session"),
    last: z
      .number()
      .optional()
      .default(5)
      .describe("Return the last N un-summarized sessions (default: 5)"),
  },
  async ({ session_id, last }) => {
    const sessionIds: string[] = [];

    if (session_id) {
      sessionIds.push(session_id);
    } else {
      const unsummarized = getUnsummarizedSessionIds();
      sessionIds.push(...unsummarized.slice(0, last));
    }

    if (sessionIds.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "All sessions are already summarized (or no sessions have enough events).",
          },
        ],
      };
    }

    const output: string[] = [];

    for (const sid of sessionIds) {
      const chunks = getSessionChunks(sid);
      if (chunks.length < 3) {
        output.push(`## Session: ${sid}\nSkipped — too few events (${chunks.length})\n`);
        continue;
      }

      // Truncate to ~6000 chars per session to avoid flooding context
      const maxChars = 6000;
      let context = "";
      for (const chunk of chunks) {
        const entry = `[${chunk.category}] ${chunk.source}\n${chunk.content}\n\n`;
        if (context.length + entry.length > maxChars) break;
        context += entry;
      }

      output.push(`## Session: ${sid}\nEvents: ${chunks.length}\n\n${context}`);
    }

    output.push(
      "---\n**Instructions:** Summarize each session above in 3-8 sentences. Cover: what was worked on, key decisions, errors resolved, files changed, and outcome. Then call `kb_store_summary` for each session with the session_id and your summary."
    );

    return {
      content: [{ type: "text" as const, text: output.join("\n") }],
    };
  }
);

// --- kb_store_summary: Store a summary generated by the calling agent ---
server.tool(
  "kb_store_summary",
  "Store a session summary generated by the calling agent. Use this after kb_summarize returns session chunks and you have written a summary.",
  {
    session_id: z
      .string()
      .describe("The session ID to store the summary for"),
    summary: z
      .string()
      .describe("The summary text (3-8 sentences)"),
    project_dir: z
      .string()
      .optional()
      .describe("Project directory — populates project_dir on the summary and backfills the session row"),
  },
  async ({ session_id, summary, project_dir }) => {
    try {
      insertSummary(session_id, summary, "agent-generated", project_dir);
      return {
        content: [
          {
            type: "text" as const,
            text: `Summary stored for session ${session_id}.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error storing summary: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- kb_store_chunk: Store a tagged chunk linked to a session ---
server.tool(
  "kb_store_chunk",
  "Store a tagged chunk in the knowledge base, linked to a session. Use for checkpoints and other session-scoped data that should be searchable but separate from permanent knowledge. If no session_id is provided, a synthetic checkpoint session is created for today's date.",
  {
    content: z
      .string()
      .describe("The chunk content to store"),
    source: z
      .string()
      .optional()
      .default("checkpoint")
      .describe("Where this chunk came from (e.g. 'checkpoint', 'agent')"),
    category: z
      .string()
      .optional()
      .default("checkpoint")
      .describe("Chunk category (e.g. 'checkpoint', 'note', 'context')"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for categorization and filtering"),
    metadata: z
      .string()
      .optional()
      .describe("Optional JSON metadata string"),
    session_id: z
      .string()
      .optional()
      .describe("Session ID to link this chunk to. If omitted, uses/creates a checkpoint session for today."),
    project_dir: z
      .string()
      .optional()
      .describe("Project directory — used for scoping and for creating the session row if needed"),
  },
  async ({ content, source, category, tags, metadata, session_id, project_dir }) => {
    try {
      const db = getKnowledgeDb();

      // Resolve session: explicit > active > local-time fallback
      const effectiveSessionId = session_id || getActiveSession() || (() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `local-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      })();
      const normalizedDir = project_dir ? project_dir.replace(/\\/g, "/") : null;
      const exists = db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(effectiveSessionId);
      if (!exists) {
        db.prepare(
          `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at, event_count_at_index)
           VALUES (?, '', ?, datetime('now'), NULL, 0, datetime('now'), 0)`
        ).run(effectiveSessionId, normalizedDir);
      } else if (normalizedDir) {
        // Backfill project_dir if it was previously null
        db.prepare(
          `UPDATE sessions SET project_dir = ? WHERE id = ? AND project_dir IS NULL`
        ).run(normalizedDir, effectiveSessionId);
      }

      // Insert chunk
      const chunkId = insertChunk(
        effectiveSessionId,
        source || "checkpoint",
        category || "checkpoint",
        content,
        metadata || null,
        new Date().toISOString(),
        normalizedDir
      );

      // Insert tags
      if (tags && tags.length > 0) {
        insertTags(chunkId, tags);
      }

      const tagStr = tags && tags.length > 0 ? ` — tags: ${tags.join(", ")}` : "";
      return {
        content: [
          {
            type: "text" as const,
            text: `Stored chunk (id: ${chunkId}) in session "${effectiveSessionId}"${tagStr}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error storing chunk: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- kb_feedback: Record outcome rating on recalled knowledge ---
server.tool(
  "kb_feedback",
  "Record whether a recalled knowledge entry was helpful, harmful, or neutral. Used during /end or mid-session to track outcome quality. Drives maturity promotion and apoptosis.",
  {
    id: z
      .coerce.number()
      .describe("Knowledge entry ID"),
    rating: z
      .enum(["helpful", "harmful", "neutral"])
      .describe("Was this knowledge entry helpful, harmful, or neutral?"),
    referenced: z.boolean().optional()
      .describe("Was this knowledge entry explicitly referenced/cited during the session?"),
  },
  async ({ id, rating, referenced }) => {
    const entry = getKnowledgeById(id);
    if (!entry) {
      return {
        content: [
          { type: "text" as const, text: `Error: no knowledge entry with id ${id}.` },
        ],
        isError: true,
      };
    }

    const feedbackEntry: FeedbackEntry = {
      id: entry.id,
      helpful: entry.helpful,
      harmful: entry.harmful,
      neutral: entry.neutral,
      success_rate: entry.success_rate,
      maturity: entry.maturity as FeedbackEntry["maturity"],
      source: entry.source,
    };

    const result = evaluateLifecycle(feedbackEntry, rating as Rating);

    if (result.autoDelete) {
      deleteKnowledgeById(id);
      // Log apoptosis to vault-writer log
      try {
        const { appendFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { homedir } = await import("node:os");
        const logPath = join(homedir(), "Obsidian Vault", ".vault-writer.log");
        const logLine = `[${new Date().toISOString()}] APOPTOSIS: id=${id} key="${entry.key || ""}" ${result.transitionMessage}\n`;
        appendFileSync(logPath, logLine);
      } catch {
        // Log file may not exist — non-critical
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `${result.transitionMessage}\nEntry ${id} (${entry.key || "no key"}) has been removed.`,
          },
        ],
      };
    }

    recordFeedback(id, rating as Rating, result.newSuccessRate, result.newMaturity, referenced);

    const lines = [
      `Feedback recorded for entry ${id} (${entry.key || "no key"}): ${rating}`,
      `Counts: ${entry.helpful + (rating === "helpful" ? 1 : 0)} helpful, ${entry.harmful + (rating === "harmful" ? 1 : 0)} harmful, ${entry.neutral + (rating === "neutral" ? 1 : 0)} neutral`,
      `Success rate: ${result.newSuccessRate !== null ? result.newSuccessRate.toFixed(2) : "N/A"}`,
      `Maturity: ${result.newMaturity}`,
    ];

    if (result.transitionMessage) {
      lines.push(`Lifecycle: ${result.transitionMessage}`);
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// --- kb_consolidate: Archive source entries into a consolidated entry ---
server.tool(
  "kb_consolidate",
  "Archive multiple knowledge entries into a new consolidated entry. The new entry should already be stored via kb_store. This tool archives the originals and inherits their feedback counts.",
  {
    source_ids: z
      .array(z.number())
      .describe("IDs of the knowledge entries to archive"),
    consolidated_id: z
      .number()
      .describe("ID of the new consolidated entry (already created via kb_store)"),
  },
  async ({ source_ids, consolidated_id }) => {
    const target = getKnowledgeById(consolidated_id);
    if (!target) {
      return {
        content: [
          { type: "text" as const, text: `Error: consolidated entry ${consolidated_id} not found. Create it via kb_store first.` },
        ],
        isError: true,
      };
    }

    const archived = archiveKnowledge(source_ids, consolidated_id);
    inheritFeedbackCounts(consolidated_id, source_ids);

    const updated = getKnowledgeById(consolidated_id);

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Consolidated ${archived} entries into #${consolidated_id} (${target.key || "no key"}).`,
            `Inherited maturity: ${updated?.maturity || "unknown"} (${updated?.helpful || 0} helpful, ${updated?.harmful || 0} harmful)`,
            `Archived source IDs: ${source_ids.join(", ")}`,
          ].join("\n"),
        },
      ],
    };
  }
);

// --- kb_recall_report: Knowledge quality analysis ---
server.tool(
  "kb_recall_report",
  "Analyze knowledge base quality: find duplicate clusters, stale entries, and consolidation candidates. Returns a markdown report.",
  {
    threshold: z.number().optional().describe("Similarity threshold for clustering (default: 0.85)"),
    stale_days: z.number().optional().describe("Days without recall to consider stale (default: 30)"),
  },
  async ({ threshold, stale_days }) => {
    const simThreshold = threshold ?? 0.85;
    const staleDays = stale_days ?? 30;

    const clusters = findSimilarityClusters(simThreshold);
    const stale = getStaleKnowledge(staleDays);

    const lines: string[] = ["# Knowledge Quality Report", ""];

    lines.push(`## Consolidation Candidates (${clusters.length} clusters at >${(simThreshold * 100).toFixed(0)}% similarity)`);
    lines.push("");
    if (clusters.length === 0) {
      lines.push("No duplicate clusters found.");
    } else {
      for (const cluster of clusters) {
        lines.push(`**Cluster** (similarity: ${(cluster.maxSimilarity * 100).toFixed(1)}%):`);
        for (const e of cluster.entries) {
          lines.push(`  - [${e.id}] ${e.key || "(no key)"}`);
        }
        lines.push("");
      }
    }

    lines.push(`## Stale Entries (${stale.length} entries, 0 recalls in ${staleDays}+ days)`);
    lines.push("");
    if (stale.length === 0) {
      lines.push("No stale entries found.");
    } else {
      for (const s of stale) {
        lines.push(`- [${s.id}] ${s.key || "(no key)"} — created: ${s.created_at.split("T")[0]}`);
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// --- kb_recalled: List knowledge entries recalled this session ---
server.tool(
  "kb_recalled",
  "List knowledge entry IDs recalled during this session. Use at /end time to know which entries to ask for feedback on.",
  {},
  async () => {
    const ids = getRecalledKnowledgeIds();
    if (ids.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "No knowledge entries were recalled this session." },
        ],
      };
    }

    const lines = ["## Recalled This Session", ""];
    for (const id of ids) {
      const entry = getKnowledgeById(id);
      if (entry) {
        lines.push(
          `- **[${id}]** ${entry.key || "(no key)"} — maturity: ${entry.maturity}, success_rate: ${entry.success_rate !== null ? entry.success_rate.toFixed(2) : "N/A"}`
        );
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Open Brain Knowledge MCP server v0.3.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
