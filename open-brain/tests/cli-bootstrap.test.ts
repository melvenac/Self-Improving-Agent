import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
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

  it("emits no SESSION_UUID line when session_id is absent", () => {
    // Better to emit nothing than to emit a wrong id.
    expect(uuidLines(run({ cwd }))).toHaveLength(0);
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
    expect(uuidLines(out)).toHaveLength(0);
  });
});
