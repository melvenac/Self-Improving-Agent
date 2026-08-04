import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listSessionTranscripts,
  readTranscript,
  readSessionTranscripts,
} from "../../../src/pipelines/dream/transcripts.js";

const HOUR = 60 * 60 * 1000;

describe("dream transcripts", () => {
  let root: string;

  function writeTranscript(
    project: string,
    sessionId: string,
    rows: unknown[],
    ageHours = 0,
  ): string {
    const dir = join(root, project);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${sessionId}.jsonl`);
    writeFileSync(path, rows.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join("\n"));
    if (ageHours) {
      const when = new Date(Date.now() - ageHours * HOUR);
      utimesSync(path, when, when);
    }
    return path;
  }

  const userTurn = (text: string) => ({ type: "user", message: { role: "user", content: text } });
  const assistantTurn = (text: string) => ({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dream-transcripts-"));
  });

  describe("listSessionTranscripts", () => {
    it("returns nothing when the transcripts directory does not exist", () => {
      const refs = listSessionTranscripts({ root: join(root, "absent"), sinceMs: 0 });
      expect(refs).toEqual([]);
    });

    it("finds transcripts across every project directory", () => {
      writeTranscript("proj-a", "aaa", [userTurn("hi")]);
      writeTranscript("proj-b", "bbb", [userTurn("hi")]);

      const refs = listSessionTranscripts({ root, sinceMs: 0 });

      expect(refs.map((r) => r.sessionId).sort()).toEqual(["aaa", "bbb"]);
      expect(refs.map((r) => r.project).sort()).toEqual(["proj-a", "proj-b"]);
    });

    it("excludes transcripts older than the window", () => {
      writeTranscript("proj", "recent", [userTurn("hi")], 1);
      writeTranscript("proj", "ancient", [userTurn("hi")], 200);

      const refs = listSessionTranscripts({ root, sinceMs: Date.now() - 72 * HOUR });

      expect(refs.map((r) => r.sessionId)).toEqual(["recent"]);
    });

    it("skips already-reconciled sessions so repeat runs converge", () => {
      writeTranscript("proj", "done", [userTurn("hi")]);
      writeTranscript("proj", "fresh", [userTurn("hi")]);

      const refs = listSessionTranscripts({ root, sinceMs: 0, excludeSessionIds: ["done"] });

      expect(refs.map((r) => r.sessionId)).toEqual(["fresh"]);
    });

    it("orders newest first, since session UUIDs carry no time component", () => {
      writeTranscript("proj", "older", [userTurn("hi")], 10);
      writeTranscript("proj", "newest", [userTurn("hi")], 1);
      writeTranscript("proj", "middle", [userTurn("hi")], 5);

      const refs = listSessionTranscripts({ root, sinceMs: 0 });

      expect(refs.map((r) => r.sessionId)).toEqual(["newest", "middle", "older"]);
    });

    it("ignores non-jsonl files", () => {
      const dir = join(root, "proj");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "notes.md"), "not a transcript");
      writeTranscript("proj", "real", [userTurn("hi")]);

      const refs = listSessionTranscripts({ root, sinceMs: 0 });

      expect(refs.map((r) => r.sessionId)).toEqual(["real"]);
    });
  });

  describe("readTranscript", () => {
    it("keeps only conversational rows", () => {
      writeTranscript("proj", "s1", [
        { type: "mode", mode: "default", sessionId: "s1" },
        { type: "permission-mode", permissionMode: "auto", sessionId: "s1" },
        { type: "last-prompt", leafUuid: "x", sessionId: "s1" },
        userTurn("the real question"),
        { type: "attachment", sessionId: "s1" },
        assistantTurn("the real answer"),
        { type: "file-history-snapshot", sessionId: "s1" },
        { type: "ai-title", sessionId: "s1" },
      ]);

      const [t] = readSessionTranscripts({ root, sinceMs: 0 });

      expect(t.turns.map((x) => x.role)).toEqual(["user", "assistant"]);
      expect(t.turns.map((x) => x.text)).toEqual(["the real question", "the real answer"]);
    });

    it("flattens text blocks and drops tool mechanics", () => {
      writeTranscript("proj", "s1", [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "first" },
              { type: "tool_use", id: "t1", name: "Bash", input: { command: "rm -rf /" } },
              { type: "text", text: "second" },
            ],
          },
        },
      ]);

      const [t] = readSessionTranscripts({ root, sinceMs: 0 });

      expect(t.turns).toHaveLength(1);
      expect(t.turns[0].text).toBe("first\nsecond");
      expect(t.turns[0].text).not.toContain("rm -rf");
    });

    it("records 1-based line numbers so evidence can be located", () => {
      writeTranscript("proj", "s1", [
        { type: "mode", mode: "default" },
        { type: "mode", mode: "default" },
        userTurn("on line three"),
      ]);

      const [t] = readSessionTranscripts({ root, sinceMs: 0 });

      expect(t.turns[0].line).toBe(3);
    });

    it("skips a malformed trailing line rather than failing the whole read", () => {
      // An open session's last line is routinely a partial write. Throwing here
      // would make dream unable to run precisely when there is most to reconcile.
      writeTranscript("proj", "s1", [
        userTurn("complete turn"),
        '{"type":"assistant","message":{"role":"assist',
      ]);

      const [t] = readSessionTranscripts({ root, sinceMs: 0 });

      expect(t.turns).toHaveLength(1);
      expect(t.turns[0].text).toBe("complete turn");
    });

    it("drops turns whose text is empty after extraction", () => {
      writeTranscript("proj", "s1", [
        { type: "user", message: { role: "user", content: "   " } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "t", name: "Bash", input: {} }] } },
        userTurn("kept"),
      ]);

      const [t] = readSessionTranscripts({ root, sinceMs: 0 });

      expect(t.turns.map((x) => x.text)).toEqual(["kept"]);
    });

    it("carries session and project identity onto every turn", () => {
      writeTranscript("my-project", "sess-123", [userTurn("hi")]);

      const [t] = readSessionTranscripts({ root, sinceMs: 0 });

      expect(t.turns[0].sessionId).toBe("sess-123");
      expect(t.turns[0].project).toBe("my-project");
    });

    it("returns an empty turn list for an unreadable file rather than throwing", () => {
      const missing = { sessionId: "gone", project: "proj", path: join(root, "nope.jsonl"), mtimeMs: 0 };

      expect(() => readTranscript(missing)).not.toThrow();
      expect(readTranscript(missing).turns).toEqual([]);
    });
  });
});
