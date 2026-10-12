import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { handleStart } from "../src/server.js";
import { renderStartReport } from "../src/pipelines/session-start/start-report.js";

const presenceCalls: Array<Record<string, unknown>> = [];
vi.mock("../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pipelines/session-start/hub-presence.js")>();
  return {
    ...actual,
    describeHubPresence: async (opts: Record<string, unknown>) => {
      presenceCalls.push(opts);
      return { lines: [], sourceRel: null, charCount: 0 };
    },
  };
});

/**
 * T-154: `open-brain start` prints the same report `ob_start` returns, from a
 * module that imports nothing from the memory half, and the hook names the command.
 */

const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const hookEntry = join(import.meta.dirname, "../src/cli-bootstrap.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const denyPath = join(import.meta.dirname, "fixtures/deny-sqlite.mjs");
const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
const repoRoot = resolve(import.meta.dirname, "../..");
const denyOptions = `--import=${pathToFileURL(denyPath).href}`;

const W3 =
  "**No open-brain MCP tools in this session** (no `ob_start` in your tool list, or the server failed to start): run the command on the hook's `CLI start (no open-brain MCP):` line with your shell, **once per session**. It prints the same report `ob_start` returns, Briefing block included, from the same code (T-154), with two differences: it proves no session (`Session ID: none — …`), and it creates a new session log on every run instead of reusing one. On a repeat `/start`, reuse the output you already have; a missing reuse note is expected on this route and is not a registration fault. Say in FLAGS that this session has no open-brain tools. If the hook printed no such line, or the line says `unavailable`, say so in FLAGS and stop.";

const TIMEOUT = 120_000;

describe("T-154 CLI start route", { timeout: TIMEOUT }, () => {
  const temps: string[] = [];
  let home: string;

  const temp = (prefix: string): string => {
    const d = mkdtempSync(join(tmpdir(), prefix));
    temps.push(d);
    return d;
  };

  beforeEach(() => {
    home = temp("t154-home-");
  });

  afterEach(() => {
    for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function fixture(schemaVersion?: number): string {
    const dir = temp("t154-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t154-fixture", version: "0.1.0" }));
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
    const target = join(dir, ".agents", "state.json");
    if (schemaVersion === undefined) {
      copyFileSync(stateFixture, target);
    } else {
      const rec = JSON.parse(readFileSync(stateFixture, "utf8"));
      rec.schema_version = schemaVersion;
      writeFileSync(target, JSON.stringify(rec, null, 2));
    }
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
    return dir;
  }

  function cli(cwd: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
    const env = { ...process.env, HOME: home, USERPROFILE: home, ...extraEnv };
    const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env, timeout: 90_000 });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  }

  function briefing(text: string, root: string): string {
    const a = text.indexOf("## Briefing");
    const b = text.indexOf("## End Briefing");
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    return text
      .slice(a, b + "## End Briefing".length)
      .split(root).join("<ROOT>")
      .split(root.split(sep).join("/")).join("<ROOT>")
      .replace(/Session \d+/g, "Session N")
      .replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?/g, "<DATE>");
  }

  it("CS-1: prints the briefing, not the old boolean lines", () => {
    const dir = fixture();
    const r = cli(dir, ["start", dir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("## Briefing");
    expect(r.stdout).toContain("## End Briefing");
    expect(r.stdout).not.toContain("SUMMARY loaded");
  });

  it("CS-2: the CLI briefing equals ob_start's", async () => {
    const a = fixture();
    const b = fixture();
    // Same HOME as the spawned CLI: the fleet block reads it, and the real one would differ.
    const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    let mcp: string;
    try {
      mcp = (await handleStart({ project_root: a })).content[0].text;
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
    const r = cli(b, ["start", b]);
    expect(r.status).toBe(0);
    expect(briefing(r.stdout, b)).toBe(briefing(mcp, a));
  });

  it("CS-3: runs with better-sqlite3 unresolvable", () => {
    const dir = fixture();
    const r = cli(dir, ["start", dir], { NODE_OPTIONS: denyOptions });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("## End Briefing");
    expect(r.stderr).not.toContain("T-154 deny");
  });

  it("CS-3b: the deny hook bites (positive control)", () => {
    const dir = temp("t154-probe-");
    const serverTs = join(import.meta.dirname, "../src/server.ts");
    const probe = join(dir, "probe.mts");
    writeFileSync(probe, `await import(${JSON.stringify(pathToFileURL(serverTs).href)});\n`);
    const env = { ...process.env, HOME: home, USERPROFILE: home, NODE_OPTIONS: denyOptions };
    const r = spawnSync(process.execPath, [tsxCli, probe], { cwd: dir, encoding: "utf8", env, timeout: 90_000 });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("T-154 deny");
  });

  it("CS-4: a refused record exits 1", () => {
    const dir = fixture(999);
    const r = cli(dir, ["start", dir]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("STATE RECORD REFUSED");
  });

  function hookLines(dir: string): string[] {
    const env = { ...process.env, HOME: home, USERPROFILE: home, OPEN_BRAIN_ACTIVE_SESSION: join(home, "slot", "active-session.json") };
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], { cwd: dir, input: JSON.stringify({}), encoding: "utf8", env, timeout: 90_000 });
    expect(r.status).toBe(0);
    return (r.stdout ?? "").split("\n").map((l) => l.replace(/\r$/, ""));
  }

  function namedFixture(name: string): string {
    const dir = join(temp("t154-named-"), name);
    mkdirSync(join(dir, ".agents"), { recursive: true });
    return dir;
  }

  it("CS-5: the hook prints the CLI command for this checkout", () => {
    const dir = fixture();
    const out = hookLines(dir);
    const re = /^CLI start \(no open-brain MCP\): node '([^']+\/cli\.js)' start '([^']+)'$/;
    const hits = out.filter((l) => re.test(l));
    expect(hits).toHaveLength(1);
    const detected = out.find((l) => l.startsWith("Project detected: "));
    expect(detected).toBeDefined();
    const printedCwd = detected!.slice("Project detected: ".length).replace(/ \(\.agents\/ found.*$/, "");
    expect(hits[0].match(re)![2]).toBe(printedCwd.replace(/\\/g, "/"));
  });

  it("CS-5b: a dollar sign in the path is single-quoted, never double-quoted", () => {
    const dir = namedFixture("t154 $proj");
    const line = hookLines(dir).find((l) => l.startsWith("CLI start (no open-brain MCP):"));
    expect(line).toBeDefined();
    expect(line!).toContain("start '");
    expect(line!).toMatch(/start '[^']*t154 \$proj'$/);
    expect(line!).not.toContain('"');
  });

  it("CS-5c: a single quote in the path prints no runnable command", () => {
    const dir = namedFixture("t154 it's");
    const out = hookLines(dir);
    const prefix = "CLI start (no open-brain MCP): ";
    const unavailable = out.filter((l) => l.startsWith(prefix + "unavailable — a path contains a single quote:"));
    expect(unavailable).toHaveLength(1);
    expect(out.filter((l) => l.startsWith(prefix + "node"))).toHaveLength(0);
  });

  it("CS-6: all three start.md copies carry the paragraph, identically", () => {
    const files = [
      ".claude/commands/start.md",
      "project-template/.claude/commands/start.md",
      "project-template/.cursor/commands/start.md",
    ];
    for (const f of files) {
      const text = readFileSync(join(repoRoot, f), "utf8").replace(/\r\n/g, "\n");
      const hits = text.split("\n").filter((l) => l === W3);
      expect(hits, f).toHaveLength(1);
    }
  });

  it("CS-7: renderStartReport passes input.callerLabel to describeHubPresence", async () => {
    const dir = fixture();
    presenceCalls.length = 0;
    await renderStartReport({ projectRoot: dir, proven: { id: null, reason: "t" }, callerLabel: "T154-LABEL" });
    expect(presenceCalls).toHaveLength(1);
    expect(presenceCalls[0].callerLabel).toBe("T154-LABEL");
  });

  it("CS-7b: each caller names itself", () => {
    const cliSrc = readFileSync(join(import.meta.dirname, "../src/cli.ts"), "utf8");
    const serverSrc = readFileSync(join(import.meta.dirname, "../src/server.ts"), "utf8");
    expect(cliSrc).toContain('callerLabel: "open-brain CLI (start)"');
    expect(serverSrc).toContain('callerLabel: "open-brain MCP server"');
  });
});
