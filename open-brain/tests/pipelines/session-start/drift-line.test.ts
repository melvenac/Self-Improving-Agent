import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { spawnAsync } from "../../spawn-async.js";
import { describeDriftLine } from "../../../src/pipelines/session-start/drift-line.js";

/**
 * T-208 r3: the SessionStart hook prints drift beside tree currency, on startup and resume.
 * Three states must stay distinct: drifted views are NAMED, a clean fixture says none, and a
 * check that cannot run says "not checked" with the cause (never "none").
 */
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const SCRIPT = resolve(__dirname, "../../../src/cli-bootstrap.ts");

const VALID_STATE = { schema_version: 3, revision: 1, project: { name: "fixture" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [], handoffs: [], sessions: [] };

function fixture(dir: string, o: { summaryVersion: string; state: string | null }): void {
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }));
  writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), `# Summary\n\n**Version:** ${o.summaryVersion}\n`);
  if (o.state !== null) writeFileSync(join(dir, ".agents", "state.json"), o.state);
}

describe("T-208 r3 the hook prints drift beside currency", { timeout: 60_000 }, () => {
  let dir: string;
  let home: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t208r3-"));
    home = mkdtempSync(join(tmpdir(), "t208r3-home-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  async function hook(source: "startup" | "resume"): Promise<string> {
    const r = await spawnAsync(process.execPath, [TSX_CLI, SCRIPT], {
      input: JSON.stringify({ cwd: dir, session_id: "208208208-bbbb-4bbb-8bbb-bbbbbbbbbbbb", hook_event_name: "SessionStart", source }),
      env: { ...process.env, HOME: home, USERPROFILE: home, OPEN_BRAIN_ACTIVE_SESSION: join(home, "slot", "active-session.json") },
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`hook exited ${r.status ?? r.signal}: ${r.stderr}`);
    return r.stdout;
  }

  it.each(["startup", "resume"] as const)("(%s) drifted views are NAMED in one line", async (source) => {
    fixture(dir, { summaryVersion: "0.0.1", state: JSON.stringify(VALID_STATE) });
    const out = await hook(source);
    const line = out.split("\n").find((l) => l.startsWith("Drift"));
    expect(line, out).toBeDefined();
    expect(line).toContain("Drift detected (1)");
    expect(line).toContain("summary-version: expected 1.2.3, got 0.0.1");
  });

  it.each(["startup", "resume"] as const)("(%s) a clean fixture says none", async (source) => {
    fixture(dir, { summaryVersion: "1.2.3", state: JSON.stringify(VALID_STATE) });
    const out = await hook(source);
    expect(out.split("\n")).toContain("Drift: none");
  });

  it.each(["startup", "resume"] as const)("(%s) an unreadable state.json is NOT CHECKED, never none", async (source) => {
    fixture(dir, { summaryVersion: "1.2.3", state: "{ this is not json" });
    const out = await hook(source);
    const line = out.split("\n").find((l) => l.startsWith("Drift"));
    expect(line, out).toBeDefined();
    expect(line).toMatch(/^Drift: not checked \(.+\)$/);
    expect(out).not.toContain("Drift: none");
  });

  it("describeDriftLine never throws: a missing project root is not checked or a plain result", () => {
    const line = describeDriftLine(join(dir, "does-not-exist"));
    expect(line.startsWith("Drift")).toBe(true);
  });
});
