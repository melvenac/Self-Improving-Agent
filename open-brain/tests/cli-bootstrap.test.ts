import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Contract tests for the SessionStart hook's SESSION_UUID emission.
 *
 * This emission broke repeatedly across ~10 sessions (wrong UUID from an mtime
 * scan, emitted twice, not emitted at all) and was verified by hand each time.
 * cli-bootstrap.ts is a top-level script, so we exercise the real entry point
 * with a real stdin payload rather than unit-testing extracted internals.
 *
 * Each test spawns a node process. Under full-suite load that takes 5–7s on
 * this machine and longer on CI, which the default 5s timeout reads as a
 * failure. 30s means a timeout here is a real hang, not contention.
 */
describe("cli-bootstrap SESSION_UUID contract", { timeout: 30_000 }, () => {
  const script = resolve(__dirname, "../src/cli-bootstrap.ts");
  let cwd: string;
  let home: string;
  let slotPath: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "ob-boot-cwd-"));
    home = mkdtempSync(join(tmpdir(), "ob-boot-home-"));
    mkdirSync(join(cwd, ".agents"), { recursive: true });
    // A fresh slot path per test, inside this test's HOME so afterEach removes
    // it. Absent until something writes it, which is the whole assertion.
    slotPath = join(home, "slot", "active-session.json");
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

  /**
   * Raw stdin, and the exit status and stderr rather than only stdout.
   * `run` above stringifies its argument, so it cannot express a payload that is
   * not valid JSON — which is the whole subject of the F4 tests below.
   */
  function runRaw(raw: string): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync("npx", ["tsx", script], {
      input: raw,
      encoding: "utf-8",
      // OPEN_BRAIN_ACTIVE_SESSION is pinned PER TEST, not left to $HOME.
      //
      // tests/setup-env.ts sets it globally to one shared temp file so the suite
      // cannot write the real ~/.claude slot, and a spawned process inherits it
      // through `...process.env`. The first version of the slot assertions below
      // checked `join(home, ".claude", "open-brain", "active-session.json")` —
      // a path the hook never writes under these tests — so "writes nothing"
      // passed whatever the code did. A vacuous negative, and the third of that
      // family in this loop.
      env: { ...process.env, HOME: home, USERPROFILE: home, OPEN_BRAIN_ACTIVE_SESSION: slotPath },
      shell: process.platform === "win32",
    });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
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

  // The only test here that spawns TWICE. Each `npx tsx` spawn costs ~2-3s
  // (npx resolution + TypeScript compile), so two of them straddle vitest's 5s
  // default and fail under load while every single-spawn sibling passes.
  it("generates a DIFFERENT uuid each run, never a reused one", () => {
    const first = uuidLines(run({ cwd }))[0];
    const second = uuidLines(run({ cwd }))[0];
    expect(first).not.toBe(second);
  }, 20000);

  it("stays silent in a subagent context (anti-loop)", () => {
    const out = run({ cwd, session_id: "should-not-appear", agent_id: "sub-1" });

    expect(out.trim()).toBe("");
    expect(uuidLines(out)).toHaveLength(0);
  });

  it("REFUSES malformed stdin rather than continuing without the payload", () => {
    // THIS TEST ASSERTED THE DEFECT UNTIL 2026-09-20, and its reasoning was the
    // trap: "malformed stdin means no usable payload, so a UUID is generated
    // rather than the session losing provenance entirely." The second half is
    // true and the first half is the mistake — ABSENT and MALFORMED are not the
    // same input. Absent means nothing was offered. Malformed means the caller
    // tried to say something and this process could not hear it, and continuing
    // then INVENTS the answer: it reads the shell's cwd as the project, greets
    // the wrong directory plausibly, and stamps a generated uuid over that
    // checkout's identity.
    //
    // Both seats hit it through the same mechanism, a Windows path in the
    // payload whose backslashes are invalid JSON escapes.
    const r = runRaw("{not json");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED/);
    expect(r.stdout).not.toMatch(/SESSION_UUID/);
  });

  it("a well-formed payload with NO session id writes nothing to the slot", () => {
    // Ruled after QA's criteria pass: generating a uuid and stamping it over the
    // checkout's identity is the defect WHATEVER the payload's shape. Printing
    // one is fine — /start registers it — but the slot is the checkout's session
    // identity, read as a fallback by every later write.
    const r = runRaw(JSON.stringify({ cwd }));
    expect(r.status).toBe(0);
    // The greeting still resolves an id, read-only.
    expect(r.stdout).toMatch(/SESSION_UUID/);
    // And says what it did NOT do, because a slot not written and a slot written
    // with the right value look identical afterwards.
    expect(r.stdout).toMatch(/Session slot NOT written/);
    expect(existsSync(slotPath)).toBe(false);
  });

  it("a payload WITH a session id still writes the slot — the guard is not a ban", () => {
    const r = runRaw(JSON.stringify({ cwd, session_id: "supplied-9876" }));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SESSION_UUID: supplied-9876/);
    expect(r.stdout).not.toMatch(/Session slot NOT written/);
    expect(existsSync(slotPath)).toBe(true);
  });

  it("still refuses to guess an id from the filesystem", () => {
    // The mtime-scan regression this suite exists for: a prior session's
    // transcript in HOME must never become this session's UUID.
    const stale = "99999999-9999-9999-9999-999999999999";
    mkdirSync(join(home, ".claude", "projects", "x"), { recursive: true });
    writeFileSync(join(home, ".claude", "projects", "x", `${stale}.jsonl`), "{}\n");

    expect(uuidLines(run({ cwd }))[0]).not.toContain(stale);
  });

  // F4 — QA reproduced this from a second seat with the same mechanism: a payload
  // whose `cwd` carried Windows backslashes (invalid JSON escapes). The hook
  // swallowed the parse error, fell through with an EMPTY payload, read
  // process.cwd() — the SHELL's directory, not the session's — printed a
  // plausible greeting for the wrong project, GENERATED a session uuid and wrote
  // it into that project's slot.
  //
  // Every part of that looks right and none of it is. G-044's family: an
  // instrument that changes what it measures while answering about somewhere else.
  it("F4: a MALFORMED payload refuses, writes nothing, and exits non-zero", () => {
    // The real shape that caused it, twice, from two seats: a Windows path whose
    // single backslashes are invalid JSON escape sequences.
    //
    // The escaping here is load-bearing and was wrong once already. Written as
    // "C:\Users\melve" in TS source, `\U` and `\m` collapse to `U` and `m`, the
    // payload becomes VALID JSON, and the test measures nothing. The assertion
    // below pins the payload itself so it cannot silently become well-formed.
    const malformed = '{"session_id":"abc","cwd":"C:\\Users\\melve"}';
    expect(() => JSON.parse(malformed)).toThrow();

    const r = runRaw(malformed);

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED/);
    expect(r.stderr).toMatch(/not valid JSON/);
    expect(r.stderr).toMatch(/malformed payload is not an absent one/);
    // No greeting a reader could mistake for a good one, and no generated uuid.
    expect(r.stdout).not.toMatch(/SESSION_UUID/);
    expect(existsSync(slotPath)).toBe(false);
  });

  it("F4: an ABSENT payload is still supported — absent and malformed are different", () => {
    // An IDE that supplies nothing is a supported case and is why a uuid is
    // generated at all. Refusing it too would turn a fix into an outage.
    const r = runRaw("");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SESSION_UUID/);
  });

  it("F4: a WELL-FORMED payload still registers the id it was given", () => {
    const r = runRaw(JSON.stringify({ cwd, session_id: "real-1234" }));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SESSION_UUID: real-1234/);
  });
});
