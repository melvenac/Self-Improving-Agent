import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnAsync } from "./spawn-async.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

/**
 * The hook runs as `node <tsx's cli> <script>`: the node binary and tsx's own
 * entry file, no npx and no shell. It used to be `npx tsx <script>` with
 * `shell: true` on win32 (npx is a .cmd shim there), and a shell joins the
 * arguments unquoted, so a script path containing a space (C:\Users\Aaron Melven\…)
 * reached tsx cut at the space. Found on the QA machine, 2026-09-24. With no
 * shell, every argument arrives verbatim on every platform.
 */
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");

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
  //
  // Both helpers are awaited, not execFileSync/spawnSync (G-042): this file's spawns were one stretch of 33-39 s with
  // no macrotask under load. await run() still throws on a non-zero exit, as execFileSync did.
  async function run(payload: unknown): Promise<string> {
    const r = await spawnAsync(process.execPath, [TSX_CLI, script], {
      input: JSON.stringify(payload),
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`hook exited ${r.status ?? r.signal}: ${r.stderr}`);
    return r.stdout;
  }

  /**
   * Raw stdin, and the exit status and stderr rather than only stdout.
   * `run` above stringifies its argument, so it cannot express a payload that is
   * not valid JSON — which is the whole subject of the F4 tests below.
   */
  async function runRaw(raw: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
    const r = await spawnAsync(process.execPath, [TSX_CLI, script], {
      input: raw,
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
    });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  }

  const uuidLines = (out: string) =>
    out.split("\n").filter((l) => l.startsWith("SESSION_UUID:"));

  it("emits SESSION_UUID exactly once when the payload carries session_id", async () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const lines = uuidLines(await run({ cwd, session_id: id }));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(`SESSION_UUID: ${id}`);
  });

  it("emits the id from the payload verbatim, not a filesystem guess", async () => {
    // Regression guard for the mtime-scan bug, which returned the PREVIOUS
    // session's UUID and mis-attributed everything stored in the new session.
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(uuidLines(await run({ cwd, session_id: id }))[0]).toContain(id);
  });

  it("accepts payload fields other than Claude Code's session_id", async () => {
    // Cursor sessions produced no UUID at all because only `session_id` was
    // read, so ob_set_session was never called and provenance was empty.
    expect(uuidLines(await run({ cwd, conversation_id: "conv-1" }))[0]).toContain("conv-1");
  });

  it("generates a UUID when the IDE supplies none", async () => {
    // Contract change (Session 42): this used to emit nothing, on the grounds
    // that no id beats a wrong id. That guard was aimed at the mtime SCAN,
    // which returned a DIFFERENT REAL session's UUID and mis-attributed data.
    // A generated UUID cannot collide with another session — what the system
    // needs is a stable per-session key, not the IDE's own id — so the choice
    // is between synthetic provenance and none at all.
    const lines = uuidLines(await run({ cwd }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^SESSION_UUID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  // The only test here that spawns TWICE. Each tsx spawn costs ~2-3s (it was
  // measured with npx resolution + TypeScript compile), so two of them straddle vitest's 5s
  // default and fail under load while every single-spawn sibling passes.
  it("generates a DIFFERENT uuid each run, never a reused one", async () => {
    const first = uuidLines(await run({ cwd }))[0];
    const second = uuidLines(await run({ cwd }))[0];
    expect(first).not.toBe(second);
  }, 20000);

  it("stays silent in a subagent context (anti-loop)", async () => {
    const out = await run({ cwd, session_id: "should-not-appear", agent_id: "sub-1" });

    expect(out.trim()).toBe("");
    expect(uuidLines(out)).toHaveLength(0);
  });

  it("REFUSES malformed stdin rather than continuing without the payload", async () => {
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
    const r = await runRaw("{not json");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED/);
    expect(r.stdout).not.toMatch(/SESSION_UUID/);
  });

  it("a well-formed payload with NO session id writes nothing to the slot", async () => {
    // Ruled after QA's criteria pass: generating a uuid and stamping it over the
    // checkout's identity is the defect WHATEVER the payload's shape. Printing
    // one is fine — /start registers it — but the slot is the checkout's session
    // identity, read as a fallback by every later write.
    const r = await runRaw(JSON.stringify({ cwd }));
    expect(r.status).toBe(0);
    // The greeting still resolves an id, read-only.
    expect(r.stdout).toMatch(/SESSION_UUID/);
    // And says what it did NOT do, because a slot not written and a slot written
    // with the right value look identical afterwards.
    expect(r.stdout).toMatch(/Session slot NOT written/);
    expect(existsSync(slotPath)).toBe(false);
  });

  it("T-048 DC-7: the slot records workspace_unusable_roots beside workspace_root_count, 0 included", async () => {
    const readSlot = (): string => readFileSync(slotPath, "utf-8");
    await runRaw(JSON.stringify({ cwd, session_id: "roots-ok-1", workspace_roots: [cwd] }));
    expect(readSlot()).toMatch(/"workspace_root_count":\s*1/);
    expect(readSlot()).toMatch(/"workspace_unusable_roots":\s*0/);
    rmSync(slotPath, { force: true });
    await runRaw(JSON.stringify({ cwd, session_id: "roots-bad-2", workspace_roots: [cwd, 7, null] }));
    expect(readSlot()).toMatch(/"workspace_unusable_roots":\s*2/);
  });

  it("a payload WITH a session id still writes the slot — the guard is not a ban", async () => {
    const r = await runRaw(JSON.stringify({ cwd, session_id: "supplied-9876" }));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SESSION_UUID: supplied-9876/);
    expect(r.stdout).not.toMatch(/Session slot NOT written/);
    expect(existsSync(slotPath)).toBe(true);
  });

  it("still refuses to guess an id from the filesystem", async () => {
    // The mtime-scan regression this suite exists for: a prior session's
    // transcript in HOME must never become this session's UUID.
    const stale = "99999999-9999-9999-9999-999999999999";
    mkdirSync(join(home, ".claude", "projects", "x"), { recursive: true });
    writeFileSync(join(home, ".claude", "projects", "x", `${stale}.jsonl`), "{}\n");

    expect(uuidLines(await run({ cwd }))[0]).not.toContain(stale);
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
  it("F4: a MALFORMED payload refuses, writes nothing, and exits non-zero", async () => {
    // The real shape that caused it, twice, from two seats: a Windows path whose
    // single backslashes are invalid JSON escape sequences.
    //
    // The escaping here is load-bearing and was wrong once already. Written as
    // "C:\Users\melve" in TS source, `\U` and `\m` collapse to `U` and `m`, the
    // payload becomes VALID JSON, and the test measures nothing. The assertion
    // below pins the payload itself so it cannot silently become well-formed.
    const malformed = '{"session_id":"abc","cwd":"C:\\Users\\melve"}';
    expect(() => JSON.parse(malformed)).toThrow();

    const r = await runRaw(malformed);

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED/);
    expect(r.stderr).toMatch(/not valid JSON/);
    expect(r.stderr).toMatch(/malformed payload is not an absent one/);
    // No greeting a reader could mistake for a good one, and no generated uuid.
    expect(r.stdout).not.toMatch(/SESSION_UUID/);
    expect(existsSync(slotPath)).toBe(false);
  });

  it("F4: an ABSENT payload is still supported — absent and malformed are different", async () => {
    // An IDE that supplies nothing is a supported case and is why a uuid is
    // generated at all. Refusing it too would turn a fix into an outage.
    const r = await runRaw("");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SESSION_UUID/);
  });

  it("F4: a WELL-FORMED payload still registers the id it was given", async () => {
    const r = await runRaw(JSON.stringify({ cwd, session_id: "real-1234" }));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SESSION_UUID: real-1234/);
  });
});

describe("cli-bootstrap T-235 P2-7 cursor dedupe", { timeout: 30_000 }, () => {
  const script = resolve(__dirname, "../src/cli-bootstrap.ts");
  let cwd: string;
  let home: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "ob-boot-p27-cwd-"));
    home = mkdtempSync(join(tmpdir(), "ob-boot-p27-home-"));
    mkdirSync(join(cwd, ".agents"), { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  async function runCursorStart(sessionId: string): Promise<{ status: number | null; stdout: string }> {
    const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
    const payload = { cwd, session_id: sessionId, cursor_version: "1.0" };
    const r = await spawnAsync(process.execPath, [TSX_CLI, script], {
      input: JSON.stringify(payload),
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    return { status: r.status, stdout: r.stdout ?? "" };
  }

  it("R1: second cursor SessionStart with the same session_id is skipped", async () => {
    const id = "dup-cursor-1111";
    const first = await runCursorStart(id);
    const second = await runCursorStart(id);
    expect(first.stdout).toMatch(/SESSION_UUID/);
    expect(second.stdout).toMatch(/SESSION_START_SKIPPED/);
    expect(second.stdout).not.toMatch(/SESSION_UUID/);
  });

  it("R3: Claude Code payload without cursor_version is never suppressed", async () => {
    const id = "cc-only-2222";
    const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
    const payload = { cwd, session_id: id };
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    const runOnce = () =>
      spawnAsync(process.execPath, [TSX_CLI, script], { input: JSON.stringify(payload), env });
    const a = await runOnce();
    const b = await runOnce();
    expect(a.stdout).toMatch(/SESSION_UUID/);
    expect(b.stdout).toMatch(/SESSION_UUID/);
    expect(b.stdout).not.toMatch(/SESSION_START_SKIPPED/);
  });
});
