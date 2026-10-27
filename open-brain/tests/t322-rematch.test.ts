import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import Database from "better-sqlite3";
import { initSchemaV2, indexKnowledge } from "../src/db-v2.js";
import { writeTriggerKeys } from "../src/trigger/keys-writer.js";
import { triggerKeysPath } from "../src/trigger/match-keys.js";
import { spawnAsync } from "./spawn-async.js";

/**
 * T-322: `open-brain rematch` rewrites one stored lesson's MATCH: line in place. The row keeps its id, its
 * counters, recall_count, last_recalled_at and created_at, so the ratings and recall history attached to the id
 * survive (ob_forget plus a fresh store loses them: feedback_log and recall_log have no foreign key).
 *
 * The module is imported dynamically so that, before it exists, each row is red on its own.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rm: any = await import("../src/pipelines/store/rematch.js").catch(() => ({}));

const ROOT = path.join(import.meta.dirname, "..");
const TSX_CLI = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = path.join(ROOT, "src", "cli.ts");
const SPAWN_TIMEOUT = 120_000;

const OLD = "MATCH: command: `skills-audit`";
const BODY = (match: string, nl = "\n") =>
  ["[EXPERIENCE] `skills-audit` with no --session audits the newest transcript", match, "ACTION: pass --session <uuid>"].join(nl);
const NOTE = (match: string, nl = "\n") =>
  ["---", "key: k", "tags: [open-brain, skills-audit]", "helpful: 0", "---", "", BODY(match, nl), ""].join(nl);

let dir: string;
let dbPath: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "t322-"));
  dbPath = path.join(dir, "knowledge-v2.db");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

/** One lesson with a note on disk and lived-in counters; returns its id. */
function seed(opts: { key?: string; body?: string; note?: string | null; nl?: string } = {}): number {
  const key = opts.key ?? "skills-audit-without-session";
  const nl = opts.nl ?? "\n";
  const vaultPath = path.join(dir, `${key}.md`);
  const note = opts.note === undefined ? NOTE(OLD, nl) : opts.note;
  if (note !== null) fs.writeFileSync(vaultPath, note, "utf-8");
  const db = new Database(dbPath);
  try {
    initSchemaV2(db);
    indexKnowledge(db, {
      vaultPath,
      key,
      content: opts.body ?? BODY(OLD, nl),
      tags: "open-brain,skills-audit",
      source: "manual",
      factKind: "event",
    });
    db.prepare(
      `UPDATE knowledge_index SET helpful = 29, harmful = 1, neutral = 4, recall_count = 38,
         last_recalled_at = '2026-10-25T00:00:00.000Z', created_at = '2026-10-15T17:16:01.390Z' WHERE key = ?`,
    ).run(key);
    return (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number }).id;
  } finally {
    db.close();
  }
}

const LIFECYCLE = "id, helpful, harmful, neutral, recall_count, last_recalled_at, created_at, fact_kind, source, tags";
function row(key = "skills-audit-without-session"): Record<string, unknown> {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare(`SELECT ${LIFECYCLE}, content, updated_at FROM knowledge_index WHERE key = ?`).get(key) as Record<string, unknown>;
  } finally {
    db.close();
  }
}
function run(id: number, match: string, opts: object = {}) {
  const db = new Database(dbPath);
  try {
    return rm.rematch(db, id, match, opts);
  } finally {
    db.close();
  }
}

describe("T-322 rematch (module)", () => {
  it("K1: rewrites the one MATCH: line in the note and in the indexed content", () => {
    const id = seed();
    const r = run(id, "none");
    expect(r).toMatchObject({ ok: true, id, before: OLD, after: "MATCH: none", unchanged: false, dryRun: false });
    expect(row().content).toBe(BODY("MATCH: none"));
    expect(fs.readFileSync(path.join(dir, "skills-audit-without-session.md"), "utf-8")).toContain("\nMATCH: none\n");
  });

  it("K2: the id, counters, recall_count, last_recalled_at, created_at, fact_kind, source and tags are kept", () => {
    const id = seed();
    const before = row();
    expect(run(id, "none").ok).toBe(true);
    const after = row();
    for (const col of LIFECYCLE.split(", ")) expect(after[col], col).toEqual(before[col]);
    expect(after.id).toBe(id);
    expect(after.recall_count).toBe(38);
    expect(after.helpful).toBe(29);
  });

  it("K3: every other byte of the note is kept, CRLF included", () => {
    const id = seed({ nl: "\r\n" });
    expect(run(id, "path: src/x.ts").ok).toBe(true);
    expect(fs.readFileSync(path.join(dir, "skills-audit-without-session.md"), "utf-8")).toBe(NOTE("MATCH: path: src/x.ts", "\r\n"));
  });

  it("K4a: an id with no row refuses", () => {
    seed();
    expect(run(999_999, "none")).toEqual({ ok: false, error: "no entry with id 999999" });
  });

  it("K4b: two MATCH: lines refuse, and nothing is written", () => {
    const two = BODY(`${OLD}\nMATCH: error: ENOENT`);
    const id = seed({ body: two, note: `---\nkey: k\n---\n\n${two}\n` });
    const r = run(id, "none");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("has 2 MATCH: line(s)");
    expect(row().content).toBe(two);
  });

  it("K4c: an archived entry refuses", () => {
    const id = seed();
    const db = new Database(dbPath);
    try {
      db.prepare("UPDATE knowledge_index SET archived_into = 0 WHERE id = ?").run(id);
    } finally {
      db.close();
    }
    const r = run(id, "none");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("is archived");
  });

  it("K4d: a value that is not one of the four MATCH kinds refuses", () => {
    const id = seed();
    for (const bad of ["cmd: x", "command:", "", "nothing"]) {
      const r = run(id, bad);
      expect(r.ok, bad).toBe(false);
      expect(r.error, bad).toContain("is not a MATCH value");
    }
    expect(row().content).toBe(BODY(OLD));
  });

  it("K4e: a missing note refuses, and the index is not touched", () => {
    const id = seed({ note: null });
    const r = run(id, "none");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("note is missing");
    expect(row().content).toBe(BODY(OLD));
  });

  it("K4f: no MATCH: line with --match none refuses (T-162: no key is already lookup-only)", () => {
    const id = seed({ body: "[EXPERIENCE] x\nACTION: y", note: "---\nkey: k\n---\n\n[EXPERIENCE] x\nACTION: y\n" });
    const r = run(id, "none");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("has 0 MATCH: line(s)");
  });

  it("K5: --dry-run reports the change and writes nothing", () => {
    const id = seed();
    const note = fs.readFileSync(path.join(dir, "skills-audit-without-session.md"), "utf-8");
    const before = row();
    expect(run(id, "none", { dryRun: true })).toMatchObject({ ok: true, before: OLD, after: "MATCH: none", unchanged: false, dryRun: true });
    expect(fs.readFileSync(path.join(dir, "skills-audit-without-session.md"), "utf-8")).toBe(note);
    expect(row()).toEqual(before);
  });

  it("K6: the same value is reported unchanged and writes nothing", () => {
    const id = seed();
    const before = row();
    expect(run(id, "command: `skills-audit`")).toMatchObject({ ok: true, unchanged: true });
    expect(row()).toEqual(before);
  });
});

describe("T-322 rematch (CLI)", () => {
  const cli = (args: string[]) =>
    spawnAsync(process.execPath, [TSX_CLI, CLI, "rematch", ...args], { cwd: dir, env: { ...process.env, KNOWLEDGE_V2_DB: dbPath } });

  it("C1: rewrites the entry and refreshes the trigger key sidecar, which then has no key for it", async () => {
    const id = seed();
    const sidecar = triggerKeysPath(dbPath);
    const db = new Database(dbPath);
    try {
      writeTriggerKeys(db, sidecar);
    } finally {
      db.close();
    }
    expect(JSON.parse(fs.readFileSync(sidecar, "utf-8")).keys.map((k: { id: number }) => k.id)).toContain(id);

    const r = await cli(["--id", String(id), "--match", "none"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`rematch: entry ${id} (skills-audit-without-session) rewritten: "${OLD}" -> "MATCH: none"`);
    expect(r.stdout).toContain("trigger keys: 0 command key(s)");
    expect(JSON.parse(fs.readFileSync(sidecar, "utf-8")).keys).toEqual([]);
    expect(row().content).toBe(BODY("MATCH: none"));
  }, SPAWN_TIMEOUT);

  it("C2: a refusal exits 1, names the reason, and leaves the store as it was", async () => {
    seed();
    const before = row();
    const r = await cli(["--id", "999999", "--match", "none"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("rematch refused: no entry with id 999999");
    expect(row()).toEqual(before);
  }, SPAWN_TIMEOUT);

  it("C3: an undeclared flag is refused before the store is opened (exit 2)", async () => {
    seed();
    const r = await cli(["--id", "1", "--mach", "none"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("rematch refused:");
    expect(r.stderr).toContain("Nothing was run");
  }, SPAWN_TIMEOUT);
});
