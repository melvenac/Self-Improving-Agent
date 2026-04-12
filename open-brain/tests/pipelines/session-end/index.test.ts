import { describe, it, expect, vi } from "vitest";
import { sessionEnd } from "../../../src/pipelines/session-end/index.js";
import type { SessionEndInput } from "../../../src/pipelines/session-end/index.js";
import type { ChunkStore, KnowledgeStore, KnowledgeEntry } from "../../../src/pipelines/session-end/types.js";

function makeMockChunkStore(): ChunkStore & { chunks: unknown[]; sessions: unknown[] } {
  const chunks: unknown[] = [];
  const sessions: unknown[] = [];
  return {
    chunks,
    sessions,
    insertChunk: vi.fn((chunk) => { chunks.push(chunk); }),
    insertSession: vi.fn((session) => { sessions.push(session); }),
    getIndexedSessionFiles: vi.fn(() => []),
  };
}

function makeMockKnowledgeStore(entries: KnowledgeEntry[] = []): KnowledgeStore {
  const entryMap = new Map(entries.map((e) => [e.id, { ...e }]));

  return {
    getEntry: vi.fn((id: number) => entryMap.get(id) ?? null),
    updateFeedback: vi.fn((id: number, rating: string) => {
      const entry = entryMap.get(id);
      if (!entry) return;
      if (rating === "helpful") entry.helpful_count++;
      else if (rating === "harmful") entry.harmful_count++;
      else entry.neutral_count++;
      const total = entry.helpful_count + entry.harmful_count + entry.neutral_count;
      entry.success_rate = total > 0 ? entry.helpful_count / total : 0;
    }),
    getEntryCounters: vi.fn((id: number) => {
      const entry = entryMap.get(id);
      if (!entry) return null;
      return {
        helpful_count: entry.helpful_count,
        harmful_count: entry.harmful_count,
        neutral_count: entry.neutral_count,
        success_rate: entry.success_rate,
        maturity: entry.maturity,
        recall_count: entry.recall_count,
      };
    }),
  };
}

function makeDefaultInput(overrides: Partial<SessionEndInput> = {}): SessionEndInput {
  return {
    options: {
      projectRoot: "/project",
      homePath: "/home/user",
      sessionId: "sess-001",
      recalledEntryIds: [],
      dryRun: false,
    },
    sessionSummary: "",
    sessionFiles: [],
    experienceFiles: [],
    previousSkillCounts: new Map(),
    chunkStore: makeMockChunkStore(),
    knowledgeStore: makeMockKnowledgeStore(),
    vaultExperiencesPath: "/vault/experiences",
    readVaultFile: vi.fn(() => null),
    writeVaultFile: vi.fn(),
    ...overrides,
  };
}

describe("sessionEnd orchestrator", () => {
  it("runs all 4 stages and returns combined result", () => {
    const entry: KnowledgeEntry = {
      id: 1,
      key: "typescript-patterns",
      content: "Use interfaces for DI",
      tags: "typescript,patterns",
      helpful_count: 1,
      harmful_count: 0,
      neutral_count: 0,
      success_rate: 1.0,
      maturity: "Progenitor",
      recall_count: 1,
      source: "agent",
      created_at: "2025-01-01T00:00:00Z",
    };

    const knowledgeStore = makeMockKnowledgeStore([entry]);
    const chunkStore = makeMockChunkStore();
    const writeVaultFile = vi.fn();

    // Vault file for frontmatter sync
    const vaultContent = `---\nid: 1\nkey: typescript-patterns\nhelpful_count: 1\nmaturity: Progenitor\n---\nSome content`;
    const readVaultFile = vi.fn((path: string) =>
      path.includes("1-typescript-patterns") ? vaultContent : null
    );

    // Session file with one event
    const sessionFiles = [
      {
        path: "/project/.agents/sessions/sess-abc.jsonl",
        content: JSON.stringify({ type: "human", content: "How do I use typescript?" }),
      },
    ];

    // 3 experience files sharing a "typescript" tag — enough to form a cluster
    const experienceFiles = [
      {
        name: "exp-1.md",
        content: `---\ntags: [typescript, patterns]\ndomain: dev\n---\nExperience 1`,
      },
      {
        name: "exp-2.md",
        content: `---\ntags: [typescript, patterns]\ndomain: dev\n---\nExperience 2`,
      },
      {
        name: "exp-3.md",
        content: `---\ntags: [typescript, patterns]\ndomain: dev\n---\nExperience 3`,
      },
    ];

    const input = makeDefaultInput({
      options: {
        projectRoot: "/project",
        homePath: "/home/user",
        sessionId: "sess-001",
        recalledEntryIds: [1],
        dryRun: false,
      },
      sessionSummary: "Worked with typescript patterns and interfaces",
      sessionFiles,
      experienceFiles,
      previousSkillCounts: new Map(),
      chunkStore,
      knowledgeStore,
      readVaultFile,
      writeVaultFile,
    });

    const result = sessionEnd(input);

    // Stage 1: chunks
    expect(result.chunks.sessionsIndexed).toBe(1);
    expect(result.chunks.chunksCreated).toBeGreaterThan(0);
    expect(result.chunks.errors).toHaveLength(0);

    // Stage 2: feedback — tag "typescript" matches summary → helpful
    expect(result.feedback.processed).toBe(1);
    expect(result.feedback.ratings[0].rating).toBe("helpful");
    expect(result.feedback.errors).toHaveLength(0);

    // Stage 3: frontmatter — file should be updated
    expect(result.frontmatter.filesUpdated).toBe(1);
    expect(writeVaultFile).toHaveBeenCalledOnce();

    // Stage 4: skills — "patterns" tag cluster (3 files, threshold=3) → new cluster
    const patternCluster = result.skills.clusters.find((c) => c.tag === "patterns" || c.tag === "typescript");
    expect(patternCluster).toBeDefined();
    expect(result.skills.pendingProposals).toBeGreaterThan(0);
  });

  it("handles empty session gracefully", () => {
    const input = makeDefaultInput();
    const result = sessionEnd(input);

    expect(result.chunks.sessionsIndexed).toBe(0);
    expect(result.chunks.chunksCreated).toBe(0);
    expect(result.feedback.processed).toBe(0);
    expect(result.feedback.ratings).toHaveLength(0);
    expect(result.frontmatter.filesUpdated).toBe(0);
    expect(result.frontmatter.filesSkipped).toBe(0);
    expect(result.skills.clusters).toHaveLength(0);
    expect(result.skills.pendingProposals).toBe(0);
    expect(result.skills.approaching).toBe(0);
  });

  it("skips frontmatter sync in dry-run mode but still runs auto-feedback", () => {
    const entry: KnowledgeEntry = {
      id: 2,
      key: "dry-run-entry",
      content: "Should be processed by feedback but not written to vault",
      tags: "session-end",
      helpful_count: 0,
      harmful_count: 0,
      neutral_count: 0,
      success_rate: 0,
      maturity: "Progenitor",
      recall_count: 1,
      source: "agent",
      created_at: "2025-01-01T00:00:00Z",
    };

    const knowledgeStore = makeMockKnowledgeStore([entry]);
    const writeVaultFile = vi.fn();
    const readVaultFile = vi.fn(() => null);

    const input = makeDefaultInput({
      options: {
        projectRoot: "/project",
        homePath: "/home/user",
        sessionId: "sess-dry",
        recalledEntryIds: [2],
        dryRun: true,
      },
      sessionSummary: "session-end pipeline was used today",
      knowledgeStore,
      readVaultFile,
      writeVaultFile,
    });

    const result = sessionEnd(input);

    // Feedback should still run
    expect(result.feedback.processed).toBe(1);
    expect(result.feedback.ratings[0].rating).toBe("helpful"); // "session-end" tag matches summary

    // Frontmatter sync skipped — no writes, filesUpdated === 0
    expect(result.frontmatter.filesUpdated).toBe(0);
    expect(result.frontmatter.filesSkipped).toBe(0);
    expect(result.frontmatter.errors).toHaveLength(0);
    expect(writeVaultFile).not.toHaveBeenCalled();
  });
});
