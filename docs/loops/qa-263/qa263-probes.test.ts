import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parseState } from "../../src/shared/state-schema.js";
import { handleStart } from "../../src/server.js";
import { describeServingBuild } from "../../src/pipelines/session-start/serving-build.js";
import {
  BRIEFING_END,
  BRIEFING_START,
  describeSkills,
  describeUsage,
  describeWorkingTree,
  renderBriefing,
} from "../../src/pipelines/session-start/briefing.js";
import { renderNextSession } from "../../src/pipelines/state-views/index.js";

/** QA 263 probes. Fixtures only; every value here is synthetic. */
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "../fixtures-state/state.json"), "utf8"));
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const tmp = (p: string): string => {
  const d = mkdtempSync(join(tmpdir(), p));
  made.push(d);
  return d;
};
const g = (cwd: string, ...a: string[]): string => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function project(): string {
  const root = tmp("qa263-start-");
  g(root, "init", "-q");
  g(root, "config", "user.email", "t@example.invalid");
  g(root, "config", "user.name", "t");
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  for (const [rel, body] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# N\n"]] as const) {
    writeFileSync(join(root, ".agents", rel), body);
  }
  const raw = structuredClone(FIXTURE);
  raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "x", pick_up: "Pick this up.", watch_out: ["w1"], open_questions: ["q1", { text: "q2", resolved_by: "D-1" }] }];
  writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(raw, null, 2) + "\n");
  writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: Fixture", "role: developer", "partner: Other", 'status_cron: "*/20 * * * *"', "---", ""].join("\n"));
  g(root, "add", "-A");
  g(root, "commit", "-q", "-m", "seed");
  return root;
}

/** A serving tree with n commits on origin/master; the build is stamped at commits[at]; `extra` local commits on top of the stamp. */
function serving(n: number, at: number, ahead = 0): string {
  const base = tmp("qa263-serving-");
  const origin = join(base, "origin.git");
  const seed = join(base, "seed");
  const tree = join(base, "tree");
  mkdirSync(origin);
  mkdirSync(seed);
  g(origin, "init", "-q", "--bare", "-b", "master");
  g(seed, "init", "-q", "-b", "master");
  g(seed, "config", "user.email", "t@example.invalid");
  g(seed, "config", "user.name", "t");
  g(seed, "remote", "add", "origin", origin);
  const shas: string[] = [];
  for (let i = 0; i < n; i++) {
    writeFileSync(join(seed, "f.txt"), `v${i}\n`);
    g(seed, "add", "-A");
    g(seed, "commit", "-q", "-m", `c${i}`);
    shas.push(g(seed, "rev-parse", "HEAD"));
  }
  g(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, tree], { stdio: "ignore" });
  let stamp = shas[at]!;
  if (ahead > 0) {
    g(tree, "config", "user.email", "t@example.invalid");
    g(tree, "config", "user.name", "t");
    for (let i = 0; i < ahead; i++) {
      writeFileSync(join(tree, `local${i}.txt`), "x");
      g(tree, "add", "-A");
      g(tree, "commit", "-q", "-m", `local${i}`);
    }
    stamp = g(tree, "rev-parse", "HEAD");
  }
  const buildDir = join(tree, "open-brain", "build");
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(join(buildDir, "build-info.json"), JSON.stringify({ commit: stamp, builtAt: "2026-10-01T10:00:00.000Z", reason: null }));
  return buildDir;
}

const blockOf = (text: string): string[] => {
  const lines = text.split("\n");
  return lines.slice(lines.indexOf(BRIEFING_START), lines.indexOf(BRIEFING_END) + 1);
};

describe("QA263 row 1: the block's first line equals the greeting's first line, LEVEL case", { timeout: 60_000 }, () => {
  it("level", async () => {
    const text = (await handleStart({ project_root: project(), serving_build_dir: serving(3, 2) })).content[0]!.text;
    const block = blockOf(text);
    expect(block[1]!.startsWith("Serving build: ")).toBe(true);
    expect(block[1]).toContain("is level with origin/master");
    expect(block[1]).toBe(text.split("\n")[0]);
  });
});

describe("QA263 row 2 + row 7: through the MCP tool (stdio, the path every runtime's /start uses)", { timeout: 120_000 }, () => {
  it("serving_build_dir is not in ob_start's schema, a call that passes it is stripped, and the MCP block is renderBriefing's", async () => {
    const ob = resolve(__dirname, "../..");
    const transport = new StdioClientTransport({
      command: join(ob, "node_modules", ".bin", "tsx"),
      args: [join(ob, "src", "server.ts")],
      cwd: ob,
      env: { ...(process.env as Record<string, string>) },
      stderr: "ignore",
    });
    const client = new Client({ name: "qa263-probe", version: "0.0.0" });
    await client.connect(transport);
    try {
      const tools = await client.listTools();
      const start = tools.tools.find((t) => t.name === "ob_start")!;
      const props = Object.keys((start.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
      expect(props).not.toContain("serving_build_dir");
      expect(props).toContain("project_root");

      const stale = serving(4, 0);
      // Control: called directly, this fixture IS stale, so a key that got through would print STALE.
      expect(describeServingBuild(stale).startsWith("SERVING BUILD IS STALE:")).toBe(true);

      const root = project();
      const res = (await client.callTool({ name: "ob_start", arguments: { project_root: root, serving_build_dir: stale } })) as {
        content: { type: string; text: string }[];
        isError?: boolean;
      };
      expect(res.isError ?? false).toBe(false);
      const text = res.content[0]!.text;
      const first = text.split("\n")[0]!;
      expect(first.startsWith("Serving build: not checked (")).toBe(true);
      expect(text).not.toContain("SERVING BUILD IS STALE");

      // Row 7: the block the MCP tool returns is renderBriefing's output for the same record.
      const block = blockOf(text);
      expect(block.length).toBeGreaterThan(5);
      const parsed = parseState(readFileSync(join(root, ".agents", "state.json"), "utf8"));
      if (!parsed.ok) throw new Error(parsed.error);
      const n = Number(block[3]!.match(/^Session (\d+) /)![1]);
      const expected = renderBriefing({
        serving: first,
        state: parsed.data,
        version: "1.0.0",
        seat: "developer",
        sessionNumber: n,
        sessionNote: null,
        date: new Date().toISOString().slice(0, 10),
        drift: [],
        usage: describeUsage(root),
        latestBrief: null,
        workingTree: describeWorkingTree(root),
        skills: describeSkills(root),
      });
      expect(block).toEqual(expected);
      // Row 6 through MCP as well: a seat carrying status_cron prints no Standing cron line and does not crash.
      expect(text).not.toContain("Standing cron");
    } finally {
      await client.close();
    }
  });
});

describe("QA263 row 2: a build AHEAD of origin/master", { timeout: 60_000 }, () => {
  it("records what the line says for a build that contains origin/master plus a local commit", () => {
    const line = describeServingBuild(serving(3, 2, 1));
    console.log(`QA263-AHEAD: ${line.replace(/\/[^ ]*qa263-serving-[^/ ]*/g, "<tmp>")}`);
    expect(line).toContain("level with origin/master");
  });
});

describe("QA263 row 3: weekly >= 98 winds down even WITH an override", () => {
  const usageFor = (u: Record<string, unknown>): string => {
    const root = tmp("qa263-usage-");
    const p = join(root, "slots.json");
    writeFileSync(p, JSON.stringify({ usageLevel: u }));
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "AGENT.md"), ["---", "name: X", `usage_file: ${p}`, "---", ""].join("\n"));
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: X", "role: planner", "---", ""].join("\n"));
    return describeUsage(root, {});
  };
  const base = { level: "GREEN", fiveHourPct: 10, fiveHourResetsAt: "2026-10-03T05:00:00Z" };
  it("98 and 99 with weeklyOverride wind down and do not name the override", () => {
    for (const pct of [98, 99, 100]) {
      const line = usageFor({ ...base, sevenDayPct: pct, weeklyOverride: "T-233" });
      expect(line).toContain("wind down");
      expect(line).not.toContain("T-233");
      expect(line).not.toContain("no new QA");
    }
  });
  it("97.9 still holds and names the override; usage_file read from tracked AGENT.md when AGENT.local.md has none", () => {
    expect(usageFor({ ...base, sevenDayPct: 97.9, weeklyOverride: "T-233" })).toContain("except T-233");
  });
  it("a bare-string usageLevel and an unknown word", () => {
    expect(usageFor as unknown).toBeTruthy();
    const root = tmp("qa263-usage-bare-");
    const p = join(root, "slots.json");
    mkdirSync(join(root, ".agents"), { recursive: true });
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", `usage_file: "${p}"`, "---", ""].join("\n"));
    writeFileSync(p, JSON.stringify({ usageLevel: "RED" }));
    expect(describeUsage(root, {})).toMatch(/^Usage: RED \+ weekly not checked → /);
    writeFileSync(p, JSON.stringify({ usageLevel: { level: "UNKNOWN", sevenDayPct: 10 } }));
    expect(describeUsage(root, {})).toMatch(/^Usage: not checked \(/);
    writeFileSync(p, "");
    expect(describeUsage(root, {})).toMatch(/^Usage: not checked \(/);
  });
});

describe("QA263 row 4: the rendered view keeps a resolved question, marked", () => {
  it("next-session.md lists both, the resolved one marked with its resolver", () => {
    const raw = structuredClone(FIXTURE);
    raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "x", open_questions: ["still open", { text: "answered", resolved_by: "D-1" }] }];
    const parsed = parseState(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    const text = renderNextSession(parsed.data, { version: "1.0.0", session: 9999 });
    expect(text).toContain("- still open\n");
    expect(text).toContain("- answered _(resolved by D-1)_");
  });
});
