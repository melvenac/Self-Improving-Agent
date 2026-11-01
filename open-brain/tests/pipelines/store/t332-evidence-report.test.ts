import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../../../src/db-v2.js";
import {
  extractPointers,
  isEvidenced,
  evidenceReport,
  renderEvidenceReport,
  openStoreReadOnly,
  type EvidenceResolver,
} from "../../../src/pipelines/store/evidence-report.js";

/**
 * T-332 option C: the evidence report, shadow only (docs/loops/t332-measure.md). A pure extractor, a strict gate
 * whose resolver is injected (so no row depends on git state), and a read-only report over a temp store built here.
 * The live store is never opened.
 */

const cliEntry = join(import.meta.dirname, "../../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs");

const AS_OF = "2026-11-01T00:00:00.000Z";
const SINCE = "2026-10-02T00:00:00.000Z"; // AS_OF - 30 days

/** Exists: one sha and one path. Nothing else does. */
const FAKE: EvidenceResolver = {
  sha: (v) => v === "3cf95a01",
  path: (p) => p === "tests/setup-env.ts",
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "t332-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

type Entry = { key: string; content: string; created: string; archivedInto?: number };
type Fire = { ids: number[]; at: string; state?: "injected" | "silent" | "not-asked" };

function buildStore(entries: Entry[], fires: Fire[]): string {
  const path = join(dir, "knowledge-v2.db");
  const db = new Database(path);
  initSchemaV2(db);
  const ins = db.prepare(
    "INSERT INTO knowledge_index (vault_path, key, content, tags, source, archived_into, created_at, updated_at) VALUES (?, ?, ?, '', 'test', ?, ?, ?)",
  );
  for (const e of entries) ins.run(`${e.key}.md`, e.key, e.content, e.archivedInto ?? null, e.created, e.created);
  const fire = db.prepare(
    "INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at) VALUES ('s', 'c', 'q', ?, ?, ?)",
  );
  for (const f of fires) fire.run(f.state ?? "injected", JSON.stringify(f.ids), f.at);
  db.close();
  return path;
}

/** ids 1..5 live, 6 archived. 1 and 3 evidenced, 4 PR only; 3, 4, 5 created in the window. */
function e3Store(): string {
  return buildStore(
    [
      { key: "old-evidenced", content: "fixed in 3cf95a01", created: "2026-09-15T12:00:00.000Z" },
      { key: "old-plain", content: "no pointer here", created: "2026-09-20T12:00:00.000Z" },
      { key: "new-evidenced", content: "pinned by tests/setup-env.ts", created: "2026-10-10T12:00:00.000Z" },
      { key: "new-pr-only", content: "landed in PR #146", created: "2026-10-12T12:00:00.000Z" },
      { key: "new-plain", content: "a plain lesson", created: "2026-10-20T12:00:00.000Z" },
      { key: "archived", content: "fixed in 3cf95a01", created: "2026-10-21T12:00:00.000Z", archivedInto: 1 },
    ],
    [
      { ids: [5], at: "2026-10-05T12:00:00.000Z" },
      { ids: [5], at: "2026-10-06T12:00:00.000Z" },
      { ids: [3], at: "2026-10-07T12:00:00.000Z" },
      { ids: [4, 5], at: "2026-10-08T12:00:00.000Z" },
      { ids: [1], at: "2026-09-01T12:00:00.000Z" },
      { ids: [], at: "2026-10-09T12:00:00.000Z", state: "silent" },
      { ids: [99], at: "2026-10-10T12:00:00.000Z" },
    ],
  );
}

describe("T-332: the evidence report (shadow only)", () => {
  it("E1: the extractor finds each pointer kind once, and skips UUID prefixes, hex words and bare numbers", () => {
    const text = [
      "fixed in 3cf95a01 and commit a1b2c3d, again 3cf95a01",
      "session fdd581a1-0000-4000-8000-0123456789ab",
      "the word defaced and the number 1234567",
      "pinned by open-brain/tests/trigger/fires.test.ts and tests/setup-env.ts",
      "brief docs/loops/t331-sim.md",
      "CI run 18234567890",
      "PR #146 and #1078",
    ].join("\n");
    expect(extractPointers(text)).toEqual([
      { kind: "sha", value: "3cf95a01" },
      { kind: "sha", value: "a1b2c3d" },
      { kind: "test", value: "open-brain/tests/trigger/fires.test.ts" },
      { kind: "test", value: "tests/setup-env.ts" },
      { kind: "loop", value: "docs/loops/t331-sim.md" },
      { kind: "run", value: "18234567890" },
      { kind: "pr", value: "146" },
      { kind: "pr", value: "1078" },
    ]);
  });

  it("E2: the strict gate counts a resolving sha, path or run id, and never a PR number", () => {
    expect(isEvidenced(extractPointers("landed in PR #146"), FAKE)).toBe(false);
    expect(isEvidenced(extractPointers("fixed in 3cf95a01"), FAKE)).toBe(true);
    expect(isEvidenced(extractPointers("fixed in a1b2c3d"), FAKE)).toBe(false);
    expect(isEvidenced(extractPointers("pinned by tests/setup-env.ts"), FAKE)).toBe(true);
    expect(isEvidenced(extractPointers("CI run 18234567890"), FAKE)).toBe(false);
    expect(isEvidenced(extractPointers("CI run 18234567890"), { ...FAKE, run: () => true })).toBe(true);
  });

  it("E3: the report counts live entries, the window, and what a gate would have withheld", () => {
    const r = evidenceReport(e3Store(), FAKE, { asOf: AS_OF, days: 30 });
    expect(r.since).toBe(SINCE);
    expect({ entries: r.entries, evidenced: r.evidenced, prOnly: r.prOnly }).toEqual({ entries: 5, evidenced: 2, prOnly: 1 });
    expect(r.byMonth).toEqual([
      { month: "2026-09", entries: 2, evidenced: 1, prOnly: 0 },
      { month: "2026-10", entries: 3, evidenced: 1, prOnly: 1 },
    ]);
    expect({ windowEntries: r.windowEntries, windowEvidenced: r.windowEvidenced }).toEqual({ windowEntries: 3, windowEvidenced: 1 });
    expect({
      injections: r.injections,
      injectionsEvidenced: r.injectionsEvidenced,
      injectedEntries: r.injectedEntries,
      injectedEntriesEvidenced: r.injectedEntriesEvidenced,
    }).toEqual({ injections: 6, injectionsEvidenced: 1, injectedEntries: 4, injectedEntriesEvidenced: 1 });
    expect(r.withheld).toEqual([
      { id: 5, key: "new-plain", injections: 3 },
      { id: 4, key: "new-pr-only", injections: 1 },
      { id: 99, key: "(not live)", injections: 1 },
    ]);
    expect(r.runResolver).toBe(false);
  });

  it("E4: the store is opened read-only, a missing store is refused and not created, and the bytes do not change", () => {
    const path = e3Store();
    const before = createHash("sha256").update(readFileSync(path)).digest("hex");
    evidenceReport(path, FAKE, { asOf: AS_OF, days: 30 });
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(before);
    const db = openStoreReadOnly(path);
    try {
      expect(db.readonly).toBe(true);
    } finally {
      db.close();
    }
    const missing = join(dir, "missing.db");
    expect(() => openStoreReadOnly(missing)).toThrow();
    expect(existsSync(missing)).toBe(false);
  });

  it("E5: the window includes both of its ends and nothing outside them", () => {
    const at = (ms: number) => new Date(Date.parse(SINCE) + ms).toISOString();
    const end = (ms: number) => new Date(Date.parse(AS_OF) + ms).toISOString();
    const path = buildStore(
      [
        { key: "at-since", content: "x", created: SINCE },
        { key: "before-since", content: "x", created: at(-1) },
      ],
      [
        { ids: [7], at: SINCE },
        { ids: [7], at: at(-1) },
        { ids: [7], at: AS_OF },
        { ids: [7], at: end(1) },
      ],
    );
    const r = evidenceReport(path, FAKE, { asOf: AS_OF, days: 30 });
    expect({ windowEntries: r.windowEntries, injections: r.injections }).toEqual({ windowEntries: 1, injections: 2 });
  });

  it("E6: the rendered report says it gates nothing, names the weak PR count, and lists the withheld ids", () => {
    const text = renderEvidenceReport(evidenceReport(e3Store(), FAKE, { asOf: AS_OF, days: 30 }));
    expect(text).toContain("shadow: nothing is gated, nothing is written");
    expect(text).toContain("PR number only 1 (weak, never counts)");
    expect(text).toContain("a gate would have withheld 5 injection(s) of 3 entries:");
    expect(text).toContain("  5 new-plain (3)");
    expect(text).toContain("CI run ids are not resolved");
  });

  it("E7: `open-brain evidence-report` runs over --db and refuses a bad --days with exit 2", () => {
    const path = e3Store();
    const run = (...a: string[]) => spawnSync(process.execPath, [tsxCli, cliEntry, "evidence-report", ...a], { encoding: "utf8", timeout: 60_000 });
    const ok = run("--db", path, "--as-of", AS_OF, "--days", "30", "--repo", join(import.meta.dirname, "../../.."));
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain("trigger injections in window: 6;");
    const bad = run("--db", path, "--days", "0");
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain("evidence-report refused: --days");
  }, 120_000);
});
