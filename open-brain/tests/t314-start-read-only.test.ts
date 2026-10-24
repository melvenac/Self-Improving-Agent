import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { renderStartReport } from "../src/pipelines/session-start/start-report.js";

vi.mock("../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

/**
 * T-314: `open-brain start --read-only` is a probe. It prints the report and writes nothing a real /start reads:
 * no session log (so no session number is taken), no role-read record, no greeting-metrics row.
 */
const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
const STORE = ".agents/role-reads.local.json";
const PROVEN = { id: null, reason: "t314 test: no session" };

let root: string;
let metricsDir: string;
let savedDb: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "t314-"));
  metricsDir = mkdtempSync(join(tmpdir(), "t314-db-"));
  savedDb = process.env.KNOWLEDGE_V2_DB;
  process.env.KNOWLEDGE_V2_DB = join(metricsDir, "knowledge-v2.db");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t314-fixture", version: "1.0.0" }));
  for (const d of ["SYSTEM", "TASKS", "SESSIONS", "roles"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
  writeFileSync(join(root, ".agents", "roles", "shared.md"), "# Shared\nSHARED-BODY-MARKER\n");
  writeFileSync(join(root, ".agents", "roles", "developer.md"), "# Developer\nDEV-BODY-MARKER\n");
  copyFileSync(stateFixture, join(root, ".agents", "state.json"));
  writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ role_docs_by_sha: true, greeting_metrics: true }));
  writeFileSync(join(root, ".agents", "AGENT.local.md"), "---\nname: Infra\nrole: developer\npartner: Atlas\n---\n");
});

afterEach(() => {
  if (savedDb === undefined) delete process.env.KNOWLEDGE_V2_DB;
  else process.env.KNOWLEDGE_V2_DB = savedDb;
  rmSync(root, { recursive: true, force: true });
  rmSync(metricsDir, { recursive: true, force: true });
});

const logs = (): string[] => readdirSync(join(root, ".agents", "SESSIONS")).filter((f) => /^Session_\d+\.md$/.test(f));
const metricsWritten = (): boolean => existsSync(join(metricsDir, "greeting-metrics.jsonl"));
// Typed loosely so the rows also run (and go red) against the product before T-314 adds the field.
const start = (readOnly: boolean) =>
  renderStartReport({ projectRoot: root, callerLabel: "t314 test", proven: PROVEN, ...(readOnly ? { readOnly: true } : {}) } as Parameters<typeof renderStartReport>[0]);

describe("T-314: start --read-only writes nothing a real start reads", { timeout: 120_000 }, () => {
  it("R1: a read-only start creates no session log and says why", async () => {
    const r = await start(true);
    expect(logs()).toEqual([]);
    expect(r.text).toContain("Session log: not created: read-only start (--read-only)");
  });

  it("R2: a read-only start records no role read, so the next real start still prints the docs in full", async () => {
    await start(true);
    expect(existsSync(join(root, STORE))).toBe(false);
    const r = await start(false);
    expect(r.text).toContain("DEV-BODY-MARKER");
  });

  it("R3: a read-only start writes no greeting-metrics row; a real start does", async () => {
    await start(true);
    expect(metricsWritten()).toBe(false);
    await start(false);
    expect(metricsWritten()).toBe(true);
  });

  it("R4: a real start still creates its session log (guard)", async () => {
    await start(false);
    expect(logs()).toHaveLength(1);
  });

  it("R5: the CLI accepts --read-only and the run leaves .agents/SESSIONS unchanged", () => {
    const r = spawnSync(process.execPath, [tsxCli, cliEntry, "start", "--read-only", root], {
      encoding: "utf8",
      env: { ...process.env, KNOWLEDGE_V2_DB: join(metricsDir, "knowledge-v2.db") },
    });
    expect(r.status, r.stderr || r.stdout.slice(0, 400)).toBe(0);
    expect(logs()).toEqual([]);
    expect(metricsWritten()).toBe(false);
  });
});
