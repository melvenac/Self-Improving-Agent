import { describe, it, expect, beforeEach } from "vitest";
import {
  categorizeEvent,
  chunkContent,
  indexSessionChunks,
  type SessionFile,
} from "../../../src/pipelines/session-end/chunk-indexer.js";
import type { ChunkStore, ChunkRow, SessionRow } from "../../../src/pipelines/session-end/types.js";

function makeStore(indexed: string[] = []): ChunkStore & { chunks: ChunkRow[]; sessions: SessionRow[] } {
  const chunks: ChunkRow[] = [];
  const sessions: SessionRow[] = [];
  return {
    chunks,
    sessions,
    insertChunk(chunk) { chunks.push(chunk); },
    insertSession(session) { sessions.push(session); },
    getIndexedSessionFiles() { return indexed; },
  };
}

describe("categorizeEvent", () => {
  it("categorizes assistant as prompt", () => {
    expect(categorizeEvent({ type: "assistant" })).toBe("prompt");
  });

  it("categorizes human as prompt", () => {
    expect(categorizeEvent({ type: "human" })).toBe("prompt");
  });

  it("categorizes tool_use Read as file_read", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Read" })).toBe("file_read");
  });

  it("categorizes tool_use Glob as file_read", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Glob" })).toBe("file_read");
  });

  it("categorizes tool_use Grep as file_read", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Grep" })).toBe("file_read");
  });

  it("categorizes tool_use Edit as file_change", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Edit" })).toBe("file_change");
  });

  it("categorizes tool_use Write as file_change", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Write" })).toBe("file_change");
  });

  it("categorizes tool_use Bash as command_output", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Bash" })).toBe("command_output");
  });

  it("categorizes tool_use unknown tool as other", () => {
    expect(categorizeEvent({ type: "tool_use", name: "Unknown" })).toBe("other");
  });

  it("categorizes tool_result Read as file_read", () => {
    expect(categorizeEvent({ type: "tool_result", name: "Read" })).toBe("file_read");
  });

  it("categorizes error as error", () => {
    expect(categorizeEvent({ type: "error" })).toBe("error");
  });

  it("categorizes unknown type as other", () => {
    expect(categorizeEvent({ type: "something_else" })).toBe("other");
  });
});

describe("chunkContent", () => {
  it("returns single chunk for short content", () => {
    const result = chunkContent("hello world");
    expect(result).toEqual(["hello world"]);
  });

  it("returns empty array for empty string", () => {
    expect(chunkContent("")).toEqual([]);
  });

  it("returns single chunk when content equals maxSize", () => {
    const content = "a".repeat(2000);
    expect(chunkContent(content)).toHaveLength(1);
  });

  it("splits content exceeding maxSize into multiple chunks", () => {
    const content = "a".repeat(4500);
    const result = chunkContent(content, 2000);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(2000);
    expect(result[1]).toHaveLength(2000);
    expect(result[2]).toHaveLength(500);
  });

  it("respects custom maxSize", () => {
    const content = "b".repeat(150);
    const result = chunkContent(content, 100);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(100);
    expect(result[1]).toHaveLength(50);
  });
});

describe("indexSessionChunks", () => {
  const projectDir = "/home/user/project";

  it("skips already-indexed session files", () => {
    const store = makeStore(["abc123.jsonl"]);
    const files: SessionFile[] = [
      { path: "/sessions/abc123.jsonl", content: '{"type":"human","content":"hi"}\n' },
    ];
    const result = indexSessionChunks(files, store, projectDir);
    expect(result.sessionsIndexed).toBe(0);
    expect(result.chunksCreated).toBe(0);
    expect(store.chunks).toHaveLength(0);
  });

  it("indexes new session files and counts sessions and chunks", () => {
    const store = makeStore([]);
    const files: SessionFile[] = [
      {
        path: "/sessions/sess001.jsonl",
        content: '{"type":"human","content":"hello"}\n{"type":"assistant","content":"world"}\n',
      },
    ];
    const result = indexSessionChunks(files, store, projectDir);
    expect(result.sessionsIndexed).toBe(1);
    expect(result.chunksCreated).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0].id).toBe("sess001");
    expect(store.chunks[0].session_id).toBe("sess001");
    expect(store.chunks[0].category).toBe("prompt");
    expect(store.chunks[0].project_dir).toBe(projectDir);
  });

  it("records errors for malformed JSONL lines", () => {
    const store = makeStore([]);
    const files: SessionFile[] = [
      {
        path: "/sessions/sess002.jsonl",
        content: '{"type":"human","content":"ok"}\nNOT_JSON\n',
      },
    ];
    const result = indexSessionChunks(files, store, projectDir);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("sess002");
    expect(result.chunksCreated).toBe(1);
  });

  it("chunks large content into multiple rows", () => {
    const store = makeStore([]);
    const bigContent = "x".repeat(5000);
    const files: SessionFile[] = [
      {
        path: "/sessions/sess003.jsonl",
        content: JSON.stringify({ type: "assistant", content: bigContent }) + "\n",
      },
    ];
    const result = indexSessionChunks(files, store, projectDir);
    // 5000 / 2000 = 3 chunks
    expect(result.chunksCreated).toBe(3);
    expect(store.chunks).toHaveLength(3);
  });

  it("skips blank lines without error", () => {
    const store = makeStore([]);
    const files: SessionFile[] = [
      {
        path: "/sessions/sess004.jsonl",
        content: '{"type":"human","content":"hi"}\n\n{"type":"assistant","content":"bye"}\n',
      },
    ];
    const result = indexSessionChunks(files, store, projectDir);
    expect(result.errors).toHaveLength(0);
    expect(result.chunksCreated).toBe(2);
  });
});
