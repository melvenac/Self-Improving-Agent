import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveSessionId,
  writeActiveSession,
  readActiveSession,
  activeSessionKey,
  currentIde,
  DEFAULT_IDE,
  detectIde,
  resolveWorkspaceDir,
  describeWorkspaceDir,
  resolveAgentIdentity,
  sessionEntryAgeMs,
  isStaleSession,
  STALE_SESSION_MS,
  type ActiveSessionEntry,
} from "../src/shared/active-session.js";

/**
 * Cursor's real SessionStart payload keys, captured 2026-07-28 by Probe from a
 * live hook fire. Recorded rather than invented: an earlier guess at this shape
 * (`conversation_id` only, no `session_id`) was wrong and cost two test cycles.
 */
const CURSOR_PAYLOAD = {
  conversation_id: "conv-1",
  cursor_version: "1.2.3",
  generation_id: "gen-1",
  hook_event_name: "sessionStart",
  is_background_agent: false,
  model: "some-model",
  session_id: "4fb505d2-491f-4510-b64f-abc5c8c023dd",
  transcript_path: "C:/x/y.jsonl",
  user_email: "someone@example.com",
  workspace_roots: ["C:/Users/melve/Projects/Self-Improving-Agent"],
};

describe("host detection", () => {
  it("identifies Cursor by cursor_version, whatever the registration said", () => {
    // Cursor also runs ~/.claude/settings.json hooks, and that copy carries no
    // --ide flag — so registration alone labelled a Cursor session "claude" and
    // let it overwrite a real Claude Code slot.
    expect(detectIde(CURSOR_PAYLOAD, "claude")).toBe("cursor");
  });

  it("falls back to how the hook was registered when the host is unknown", () => {
    expect(detectIde({ session_id: "x" }, "claude")).toBe("claude");
    expect(detectIde({ session_id: "x" }, "someide")).toBe("someide");
  });

  it("does not mistake Claude Code for Cursor", () => {
    expect(detectIde({ session_id: "x", cwd: "c:/p" })).toBe(DEFAULT_IDE);
  });
});

describe("workspace resolution", () => {
  it("reads workspace_roots rather than the config-dir cwd", () => {
    // Cursor invokes hooks with cwd = ~/.cursor, so the fallback is wrong and
    // would key the slot under a directory that is not the project.
    expect(resolveWorkspaceDir(CURSOR_PAYLOAD, "C:/Users/melve/.cursor"))
      .toBe("C:/Users/melve/Projects/Self-Improving-Agent");
  });

  it("falls back when the payload carries no workspace", () => {
    expect(resolveWorkspaceDir({ session_id: "x" }, "c:/fallback")).toBe("c:/fallback");
  });

  it("accepts a bare string as well as an array", () => {
    expect(resolveWorkspaceDir({ workspace_roots: "c:/w" }, "c:/f")).toBe("c:/w");
  });

  it("accepts objects with a path-like field", () => {
    expect(resolveWorkspaceDir({ workspace_roots: [{ path: "c:/w" }] }, "c:/f")).toBe("c:/w");
    expect(resolveWorkspaceDir({ workspace_roots: [{ uri: "c:/u" }] }, "c:/f")).toBe("c:/u");
  });

  it("takes the first usable root in a multi-root workspace", () => {
    expect(resolveWorkspaceDir({ workspace_roots: ["", "c:/second"] }, "c:/f")).toBe("c:/second");
  });

  it("ignores unusable entries rather than keying a slot to empty string", () => {
    expect(resolveWorkspaceDir({ workspace_roots: [null, 42, {}] }, "c:/f")).toBe("c:/f");
  });

  it("also accepts the camelCase spelling", () => {
    expect(resolveWorkspaceDir({ workspaceRoots: ["c:/w"] }, "c:/f")).toBe("c:/w");
  });
});

describe("workspace resolution reports why", () => {
  it("names workspace_roots when the payload supplied the workspace", () => {
    const r = describeWorkspaceDir(CURSOR_PAYLOAD, "C:/Users/melve/.cursor");
    expect(r.dir).toBe("C:/Users/melve/Projects/Self-Improving-Agent");
    expect(r.dir_source).toBe("workspace_roots");
    expect(r.root_count).toBe(1);
  });

  // The Bug A signature. `payload_keys` records that `workspace_roots` was sent
  // but not that it was empty, so a home-dir slot was indistinguishable from a
  // legitimate one. This is the case that has to be readable off the file.
  it("distinguishes an EMPTY workspace_roots from an absent one", () => {
    const empty = describeWorkspaceDir({ workspace_roots: [] }, "C:/Users/melve/.claude");
    expect(empty.dir).toBe("C:/Users/melve/.claude");
    expect(empty.dir_source).toBe("fallback:empty_roots");
    expect(empty.root_count).toBe(0);

    const absent = describeWorkspaceDir({}, "C:/Users/melve/.claude");
    expect(absent.dir_source).toBe("fallback:absent");
    expect(absent.root_count).toBe(0);
  });

  it("treats a roots array of only unusable entries as empty, not absent", () => {
    const r = describeWorkspaceDir({ workspace_roots: ["", "   ", {}] }, "/fallback");
    expect(r.dir_source).toBe("fallback:empty_roots");
    expect(r.root_count).toBe(0);
  });

  it("counts every usable root, not just the one it picked", () => {
    const r = describeWorkspaceDir({ workspace_roots: ["/a", "/b", "/c"] }, "/fallback");
    expect(r.dir).toBe("/a");
    expect(r.root_count).toBe(3);
  });

  it("keeps resolveWorkspaceDir answering exactly as before", () => {
    expect(resolveWorkspaceDir(CURSOR_PAYLOAD, "/fb")).toBe(
      "C:/Users/melve/Projects/Self-Improving-Agent",
    );
    expect(resolveWorkspaceDir({}, "/fb")).toBe("/fb");
  });
});

describe("agent identity", () => {
  it("captures the model and host version Cursor already sends", () => {
    const id = resolveAgentIdentity(CURSOR_PAYLOAD);
    expect(id.model).toBe("some-model");
    expect(id.cli_version).toBe("1.2.3");
  });

  // The slot file is a diagnostic record, not an identity store. user_email
  // rides along in the same payload and must never be persisted.
  it("never reads user_email, which is in the same payload", () => {
    const id = resolveAgentIdentity(CURSOR_PAYLOAD) as Record<string, unknown>;
    expect(Object.keys(id).sort()).toEqual(["cli_version", "model"]);
    expect(JSON.stringify(id)).not.toContain("example.com");
  });

  it("omits fields the host did not send rather than writing empty strings", () => {
    expect(resolveAgentIdentity({})).toEqual({});
    expect(resolveAgentIdentity({ model: "   " })).toEqual({});
  });
});

describe("session staleness", () => {
  const at = (iso: string): ActiveSessionEntry => ({
    uuid: "u", project_dir: "/p", source: "session_id", started_at: iso,
  });
  const NOW = Date.parse("2026-08-13T20:00:00.000Z");

  it("accepts a slot from this working session", () => {
    expect(isStaleSession(at("2026-08-13T18:00:00.000Z"), NOW)).toBe(false);
  });

  // The observed failure: 2026-07-28 slot returned to a 2026-08-13 chat.
  it("rejects the sixteen-day-old slot that went unnoticed", () => {
    const entry = at("2026-07-28T23:35:38.908Z");
    expect(isStaleSession(entry, NOW)).toBe(true);
    expect(sessionEntryAgeMs(entry, NOW)! / 86_400_000).toBeGreaterThan(15);
  });

  it("treats a slot with no usable timestamp as stale, not as fresh", () => {
    expect(isStaleSession(at(""), NOW)).toBe(true);
    expect(isStaleSession(at("not-a-date"), NOW)).toBe(true);
    expect(sessionEntryAgeMs(at("not-a-date"), NOW)).toBeNull();
  });

  it("puts the boundary at STALE_SESSION_MS exactly", () => {
    expect(isStaleSession(at(new Date(NOW - STALE_SESSION_MS).toISOString()), NOW)).toBe(false);
    expect(isStaleSession(at(new Date(NOW - STALE_SESSION_MS - 1).toISOString()), NOW)).toBe(true);
  });
});

describe("IDE scoping", () => {
  it("defaults to claude so existing installs keep working", () => {
    expect(currentIde({})).toBe(DEFAULT_IDE);
    expect(activeSessionKey("c:/p")).toBe(`c:/p::${DEFAULT_IDE}`);
  });

  it("reads OPEN_BRAIN_IDE, lowercased and trimmed", () => {
    expect(currentIde({ OPEN_BRAIN_IDE: "  Cursor " })).toBe("cursor");
  });

  it("falls back to the default for a blank value", () => {
    expect(currentIde({ OPEN_BRAIN_IDE: "   " })).toBe(DEFAULT_IDE);
  });

  it("produces a distinct key per IDE on the same project", () => {
    expect(activeSessionKey("c:/p", "cursor")).not.toBe(activeSessionKey("c:/p", "claude"));
  });
});

/**
 * Cursor sessions registered no session UUID at all: cli-bootstrap only read
 * Claude Code's `session_id` field, and Cursor does not reliably inject hook
 * stdout into agent context. ob_set_session was therefore never called, leaving
 * recall_log and feedback_log empty and shadow recall with no ground truth.
 */
describe("resolveSessionId", () => {
  it("reads Claude Code's session_id", () => {
    expect(resolveSessionId({ session_id: "abc" })).toEqual({ uuid: "abc", source: "session_id" });
  });

  it("accepts conversation_id, which Claude Code never sends", () => {
    expect(resolveSessionId({ conversation_id: "xyz" })?.uuid).toBe("xyz");
  });

  it("accepts camelCase spellings", () => {
    expect(resolveSessionId({ sessionId: "a" })?.uuid).toBe("a");
    expect(resolveSessionId({ conversationId: "b" })?.uuid).toBe("b");
  });

  it("prefers session_id when several fields are present", () => {
    const r = resolveSessionId({ conversation_id: "conv", session_id: "sess" });
    expect(r?.uuid).toBe("sess");
    expect(r?.source).toBe("session_id");
  });

  it("reports which field supplied the id, so the real schema is recoverable", () => {
    expect(resolveSessionId({ conversationId: "v" })?.source).toBe("conversationId");
  });

  it("returns null for an empty payload so the caller can generate one", () => {
    expect(resolveSessionId({})).toBeNull();
  });

  it("ignores blank and non-string values", () => {
    expect(resolveSessionId({ session_id: "   " })).toBeNull();
    expect(resolveSessionId({ session_id: 42 })).toBeNull();
    expect(resolveSessionId({ session_id: null })).toBeNull();
  });
});

describe("active session file", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ob-active-"));
    path = join(dir, "state", "active-session.json");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  const entry = (uuid: string, project = "c:/p") => ({
    uuid,
    project_dir: project,
    source: "session_id",
    started_at: "2026-07-28T00:00:00.000Z",
  });

  it("returns null when the file does not exist", () => {
    expect(readActiveSession(path, "c:/p")).toBeNull();
  });

  it("creates missing parent directories", () => {
    writeActiveSession(path, "c:/p", entry("u1"));
    expect(existsSync(path)).toBe(true);
  });

  it("round-trips an entry", () => {
    writeActiveSession(path, "c:/p", entry("u1"));
    expect(readActiveSession(path, "c:/p")?.uuid).toBe("u1");
  });

  it("keeps projects separate", () => {
    writeActiveSession(path, "c:/a", entry("ua", "c:/a"));
    writeActiveSession(path, "c:/b", entry("ub", "c:/b"));

    expect(readActiveSession(path, "c:/a")?.uuid).toBe("ua");
    expect(readActiveSession(path, "c:/b")?.uuid).toBe("ub");
  });

  it("keeps two IDEs on the SAME project separate", () => {
    // Observed live: a Claude Code resume overwrote Cursor's entry, and Cursor
    // then filed six recalls under the Claude session's UUID. Both IDEs looked
    // healthy the whole time.
    const project = "c:/users/melve/projects/self-improving-agent";
    writeActiveSession(path, activeSessionKey(project, "cursor"), entry("cursor-uuid"));
    writeActiveSession(path, activeSessionKey(project, "claude"), entry("claude-uuid"));

    expect(readActiveSession(path, activeSessionKey(project, "cursor"))?.uuid).toBe("cursor-uuid");
    expect(readActiveSession(path, activeSessionKey(project, "claude"))?.uuid).toBe("claude-uuid");
  });

  it("does not hand one IDE another IDE's session", () => {
    const project = "c:/p";
    writeActiveSession(path, activeSessionKey(project, "claude"), entry("claude-uuid"));

    // Cursor has no slot yet — it must get null, not Claude Code's session.
    expect(readActiveSession(path, activeSessionKey(project, "cursor"))).toBeNull();
  });

  it("overwrites the same project — latest session start wins", () => {
    writeActiveSession(path, "c:/p", entry("old"));
    writeActiveSession(path, "c:/p", entry("new"));
    expect(readActiveSession(path, "c:/p")?.uuid).toBe("new");
  });

  it("returns null for an unknown project rather than the wrong session", () => {
    writeActiveSession(path, "c:/a", entry("ua", "c:/a"));
    expect(readActiveSession(path, "c:/other")).toBeNull();
  });

  it("survives a corrupt file instead of breaking session start", () => {
    writeFileSync(path.replace(join("state", "active-session.json"), "x.json"), "");
    writeActiveSession(path, "c:/p", entry("u1"));
    writeFileSync(path, "{not json");

    expect(readActiveSession(path, "c:/p")).toBeNull();
    expect(() => writeActiveSession(path, "c:/p", entry("u2"))).not.toThrow();
    expect(readActiveSession(path, "c:/p")?.uuid).toBe("u2");
  });

  it("preserves the source field for diagnosing an unknown IDE payload", () => {
    writeActiveSession(path, "c:/p", { ...entry("u1"), source: "conversation_id" });
    expect(readActiveSession(path, "c:/p")?.source).toBe("conversation_id");
  });
});
