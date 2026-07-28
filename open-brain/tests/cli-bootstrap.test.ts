import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Contract tests for the SessionStart hook's SESSION_UUID emission.
 *
 * This emission broke repeatedly across ~10 sessions (wrong UUID from an mtime
 * scan, emitted twice, not emitted at all) and was verified by hand each time.
 * cli-bootstrap.ts is a top-level script, so we exercise the real entry point
 * with a real stdin payload rather than unit-testing extracted internals.
 */
describe("cli-bootstrap SESSION_UUID contract", () => {
  const script = resolve(__dirname, "../src/cli-bootstrap.ts");
  let cwd: string;
  let home: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "ob-boot-cwd-"));
    home = mkdtempSync(join(tmpdir(), "ob-boot-home-"));
    mkdirSync(join(cwd, ".agents"), { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  /** Run the hook with a payload on stdin, in an isolated HOME. */
  function run(payload: unknown): string {
    return execFileSync("npx", ["tsx", script], {
      input: JSON.stringify(payload),
      encoding: "utf-8",
      env: { ...process.env, HOME: home, USERPROFILE: home },
      shell: process.platform === "win32",
    });
  }

  const uuidLines = (out: string) =>
    out.split("\n").filter((l) => l.startsWith("SESSION_UUID:"));

  it("emits SESSION_UUID exactly once when the payload carries session_id", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const lines = uuidLines(run({ cwd, session_id: id }));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(`SESSION_UUID: ${id}`);
  });

  it("emits the id from the payload verbatim, not a filesystem guess", () => {
    // Regression guard for the mtime-scan bug, which returned the PREVIOUS
    // session's UUID and mis-attributed everything stored in the new session.
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(uuidLines(run({ cwd, session_id: id }))[0]).toContain(id);
  });

  it("accepts payload fields other than Claude Code's session_id", () => {
    // Cursor sessions produced no UUID at all because only `session_id` was
    // read, so ob_set_session was never called and provenance was empty.
    expect(uuidLines(run({ cwd, conversation_id: "conv-1" }))[0]).toContain("conv-1");
  });

  it("generates a UUID when the IDE supplies none", () => {
    // Contract change (Session 42): this used to emit nothing, on the grounds
    // that no id beats a wrong id. That guard was aimed at the mtime SCAN,
    // which returned a DIFFERENT REAL session's UUID and mis-attributed data.
    // A generated UUID cannot collide with another session — what the system
    // needs is a stable per-session key, not the IDE's own id — so the choice
    // is between synthetic provenance and none at all.
    const lines = uuidLines(run({ cwd }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^SESSION_UUID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("generates a DIFFERENT uuid each run, never a reused one", () => {
    const first = uuidLines(run({ cwd }))[0];
    const second = uuidLines(run({ cwd }))[0];
    expect(first).not.toBe(second);
  });

  it("stays silent in a subagent context (anti-loop)", () => {
    const out = run({ cwd, session_id: "should-not-appear", agent_id: "sub-1" });

    expect(out.trim()).toBe("");
    expect(uuidLines(out)).toHaveLength(0);
  });

  it("does not crash on malformed stdin", () => {
    const out = execFileSync("npx", ["tsx", script], {
      input: "{not json",
      encoding: "utf-8",
      env: { ...process.env, HOME: home, USERPROFILE: home },
      shell: process.platform === "win32",
    });
    // Malformed stdin means no usable payload, so a UUID is generated rather
    // than the session losing provenance entirely.
    expect(uuidLines(out)).toHaveLength(1);
  });

  it("still refuses to guess an id from the filesystem", () => {
    // The mtime-scan regression this suite exists for: a prior session's
    // transcript in HOME must never become this session's UUID.
    const stale = "99999999-9999-9999-9999-999999999999";
    mkdirSync(join(home, ".claude", "projects", "x"), { recursive: true });
    writeFileSync(join(home, ".claude", "projects", "x", `${stale}.jsonl`), "{}\n");

    expect(uuidLines(run({ cwd }))[0]).not.toContain(stale);
  });
});
