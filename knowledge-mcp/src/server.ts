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
} from "./db.js";
import { indexSessionFile, indexAllUnindexed } from "./indexer.js";

const server = new McpServer({
  name: "knowledge-mcp",
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
        const matches = recall(query, {
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

          results.push(`### ${typeLabel} ${match.source}`);
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
  "Store a piece of knowledge in the knowledge base. Use for facts, notes, preferences, or anything worth remembering permanently. By default, knowledge is stored globally (available across all projects). Set scope to 'project' and pass your working directory as project_dir to scope it to a specific project.",
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
  },
  async ({ content, key, tags, source, scope, project_dir }) => {
    const effectiveProjectDir = scope === "project" ? project_dir || null : null;
    const id = insertKnowledge(content, key, tags, source, effectiveProjectDir || undefined);
    const scopeLabel = effectiveProjectDir ? ` [project: ${effectiveProjectDir}]` : " [global]";
    return {
      content: [
        {
          type: "text" as const,
          text: `Stored knowledge (id: ${id})${key ? ` with key "${key}"` : ""}${scopeLabel}${tags && tags.length > 0 ? ` — tags: ${tags.join(", ")}` : ""}`,
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
  },
  async ({ session_id, summary }) => {
    try {
      insertSummary(session_id, summary, "agent-generated");
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge MCP server v0.3.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
