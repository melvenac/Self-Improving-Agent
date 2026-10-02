import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { spawnAsync } from "../../spawn-async.js";
import { describeTreeCurrency, fetchOrigin } from "../../../src/pipelines/session-start/tree-currency.js";

/**
 * T-208: the SessionStart hook fetches (bounded, pruning) BEFORE it judges
 * currency, on startup AND resume. Every row runs the real hook entry point on a
 * local-path origin: no network. The first row is the evidence's own shape: an
 * origin that moved after the last fetch read "level" before the change.
 */
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const SCRIPT = resolve(__dirname, "../../../src/cli-bootstrap.ts");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function writeState(dir: string, revision: number): void {
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(
    join(dir, ".agents", "state.json"),
    JSON.stringify({
      schema_version: 1, revision, project: { name: "fixture" }, objective: null, tasks: [], verified: [], gaps: [],
      decisions: [], handoff: { pick_up: "", watch_out: [], open_questions: [], session: 0 }, last_session: { n: 0, date: "2026-01-01", uuid: null },
    }) + "\n",
  );
}

function makeClone(root: string): { clone: string; origin: string; seed: string } {
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");
  mkdirSync(origin);
  mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  writeState(seed, 1);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(clone, "config", "user.email", "t@example.com");
  git(clone, "config", "user.name", "T");
  return { clone, origin, seed };
}

function advanceOrigin(seed: string, revision: number): void {
  writeState(seed, revision);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", `rev ${revision}`);
  git(seed, "push", "-q", "origin", "master");
}

describe("T-208 the SessionStart hook fetches before it judges currency", { timeout: 60_000 }, () => {
  let root: string;
  let home: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t208-"));
    home = mkdtempSync(join(tmpdir(), "t208-home-"));
  });
  afterEach(async () => {
    // Async retry, not rmSync: row 3 leaves a killed fetch's helper process alive for a few
    // seconds on Windows (the kill reaches git, not its children), and it holds the clone's cwd.
    for (const dir of [root, home]) {
      for (let i = 0; i < 40; i++) {
        try {
          rmSync(dir, { recursive: true, force: true });
          break;
        } catch (err) {
          if (i === 39) throw err;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
  });

  async function hook(cwd: string, source: "startup" | "resume"): Promise<string> {
    const r = await spawnAsync(process.execPath, [TSX_CLI, SCRIPT], {
      input: JSON.stringify({ cwd, session_id: "208208208-aaaa-4aaa-8aaa-aaaaaaaaaaaa", hook_event_name: "SessionStart", source }),
      env: { ...process.env, HOME: home, USERPROFILE: home, OPEN_BRAIN_ACTIVE_SESSION: join(home, "slot", "active-session.json") },
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`hook exited ${r.status ?? r.signal}: ${r.stderr}`);
    return r.stdout;
  }

  it.each(["startup", "resume"] as const)("row 1 + 6 (%s): an origin that moved after the last fetch reads behind, never level", async (source) => {
    const { clone, seed } = makeClone(root);
    advanceOrigin(seed, 2); // the clone has NOT fetched
    const out = await hook(clone, source);
    expect(out).toContain("THIS TREE IS STALE: 1 commit behind origin/master");
    expect(out).not.toContain("level with");
  });

  it.each(["startup", "resume"] as const)("row 5 + 6 (%s): prune is proven, a branch deleted on the origin is gone after start", async (source) => {
    const { clone, seed } = makeClone(root);
    git(seed, "push", "-q", "origin", "master:refs/heads/feature");
    git(clone, "fetch", "-q", "origin");
    expect(git(clone, "branch", "-r")).toContain("origin/feature");
    git(seed, "push", "-q", "origin", ":feature");
    expect(git(clone, "branch", "-r")).toContain("origin/feature"); // unpruned until start
    await hook(clone, source);
    expect(git(clone, "branch", "-r")).not.toContain("origin/feature");
  });

  it("row 2: an unreachable origin prints the FAILED line and the OLD fetch time, and never says level", async () => {
    const { clone } = makeClone(root);
    git(clone, "fetch", "-q", "origin"); // an old fetch exists
    git(clone, "remote", "set-url", "origin", join(root, "does-not-exist.git"));
    const out = await hook(clone, "startup");
    const failed = out.split("\n").find((l) => l.startsWith("fetch FAILED:"));
    expect(failed, out).toBeDefined();
    expect(failed).toMatch(/; currency is against a fetch from \d{4}-\d\d-\d\dT[\d:.]+Z$/);
    expect(out).not.toContain("level with");
  });

  it("row 3: a hanging remote is bounded, and the result is the FAILED line", () => {
    const { clone } = makeClone(root);
    const hang = join(root, "hang.mjs");
    writeFileSync(hang, "setTimeout(() => {}, 4000);\n");
    git(clone, "config", "remote.origin.uploadpack", `"${process.execPath.replace(/\\/g, "/")}" "${hang.replace(/\\/g, "/")}"`);
    const t0 = Date.now();
    const f = fetchOrigin(clone, 1500);
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect(f.ok).toBe(false);
    expect(f.cause).toContain("timed out after 1500 ms");
    const lines = describeTreeCurrency(clone, { fetch: f }).lines;
    expect(lines[0]).toMatch(/^fetch FAILED: timed out after 1500 ms; currency is against a fetch from /);
    expect(lines.join("\n")).not.toContain("level with");
  });

  it("a successful fetch leaves the lines exactly as before (no FAILED line)", () => {
    const { clone } = makeClone(root);
    const f = fetchOrigin(clone);
    expect(f.ok).toBe(true);
    const r = describeTreeCurrency(clone, { fetch: f });
    expect(r.severity).toBe("current");
    expect(r.lines.join("\n")).toContain("level with origin/master");
    expect(r.lines.join("\n")).not.toContain("FAILED");
  });
});
