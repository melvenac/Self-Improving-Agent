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
 * T-162 slice A: `open-brain rematch` ADDS a first MATCH: line to a lesson that has none (stored before D-155),
 * keeping its id and counts, so lessons like 292 and 604 can be keyed. T-322's rewrite path is unchanged
 * (tests/t322-rematch.test.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rm: any = await import("../src/pipelines/store/rematch.js").catch(() => ({}));

const ROOT = path.join(import.meta.dirname, "..");
const TSX_CLI = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = path.join(ROOT, "src", "cli.ts");
const SPAWN_TIMEOUT = 120_000;

const KEY = "mutation-testing-verify-the-mutation-landed";
const VALUE = "command: `apply.cjs`";
const ADDED = `MATCH: ${VALUE}`;
const LESSON = (nl = "\n") =>
  ["[EXPERIENCE] A mutation script whose regex never compiled reads as a surviving mutant", "ACTION: diff the file after applying it"].join(nl);
const NOTE = (body: string, nl = "\n") => ["---", "key: k", "tags: [testing]", "helpful: 0", "---", "", body, ""].join(nl);

let dir: string;
let dbPath: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "t162a-"));
  dbPath = path.join(dir, "knowledge-v2.db");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

const notePath = (key = KEY) => path.join(dir, `${key}.md`);
const readNote = (key = KEY) => fs.readFileSync(notePath(key), "utf-8");

/** One lesson with no MATCH: line (unless the caller gives one), a note on disk and lived-in counters; returns its id. */
function seed(opts: { key?: string; body?: string; note?: string; nl?: string } = {}): number {
  const key = opts.key ?? KEY;
  const nl = opts.nl ?? "\n";
  fs.writeFileSync(notePath(key), opts.note ?? NOTE(LESSON(nl), nl), "utf-8");
  const db = new Database(dbPath);
  try {
    initSchemaV2(db);
    indexKnowledge(db, {
      vaultPath: notePath(key),
      key,
      content: opts.body ?? LESSON(nl),
      tags: "testing",
      source: "manual",
      factKind: "event",
    });
    db.prepare(
      `UPDATE knowledge_index SET helpful = 7, harmful = 0, neutral = 2, recall_count = 11,
         last_recalled_at = '2026-10-20T00:00:00.000Z', created_at = '2026-09-01T00:00:00.000Z' WHERE key = ?`,
    ).run(key);
    return (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number }).id;
  } finally {
    db.close();
  }
}

const LIFECYCLE = "id, helpful, harmful, neutral, recall_count, last_recalled_at, created_at, fact_kind, source, tags";
function row(key = KEY): Record<string, unknown> {
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

describe("T-162 slice A: rematch adds a first MATCH: line (module)", () => {
  it("A1: a lesson with no MATCH: line gets one, as the last body line of the note and of the indexed content", () => {
    const id = seed();
    const r = run(id, VALUE);
    expect(r).toMatchObject({ ok: true, id, before: null, after: ADDED, added: true, unchanged: false, dryRun: false });
    expect(row().content).toBe(`${LESSON()}\n${ADDED}`);
    expect(readNote()).toBe(NOTE(`${LESSON()}\n${ADDED}`));
  });

  it("A2: the id, counters, recall_count, last_recalled_at, created_at, fact_kind, source and tags are kept", () => {
    const id = seed();
    const before = row();
    expect(run(id, VALUE).ok).toBe(true);
    const after = row();
    for (const col of LIFECYCLE.split(", ")) expect(after[col], col).toEqual(before[col]);
    expect(after.recall_count).toBe(11);
  });

  it("A3: a CRLF note gets a CRLF line, and every other byte is kept", () => {
    const id = seed({ nl: "\r\n" });
    expect(run(id, VALUE).ok).toBe(true);
    expect(readNote()).toBe(NOTE(`${LESSON("\r\n")}\r\n${ADDED}`, "\r\n"));
    expect(row().content).toBe(`${LESSON("\r\n")}\r\n${ADDED}`);
  });

  it("A4: a note with a ## Log gets the line at the end of its current value, before the log", () => {
    const log = ["", "## Log", "", "- 2026-10-01: the value before"];
    const id = seed({ body: "the value now", note: NOTE(["the value now", ...log].join("\n")) });
    expect(run(id, VALUE).ok).toBe(true);
    expect(readNote()).toBe(NOTE(["the value now", ADDED, ...log].join("\n")));
    expect(row().content).toBe(`the value now\n${ADDED}`);
  });

  it("A5: a note and an index that disagree (one MATCH: line against none) refuse either way, and nothing is written", () => {
    const noteHasIt = NOTE(`${LESSON()}\nMATCH: none`);
    const a = seed({ note: noteHasIt });
    const ra = run(a, VALUE);
    expect(ra.ok).toBe(false);
    expect(ra.error).toContain("they disagree");
    expect(readNote()).toBe(noteHasIt);
    expect(row().content).toBe(LESSON());

    const b = seed({ key: "k2", body: `${LESSON()}\nMATCH: none` });
    const rb = run(b, VALUE);
    expect(rb.ok).toBe(false);
    expect(rb.error).toContain("they disagree");
    expect(readNote("k2")).toBe(NOTE(LESSON()));
    expect(row("k2").content).toBe(`${LESSON()}\nMATCH: none`);
  });

  it("A6: --match none on a lesson with no MATCH: line refuses (it is already lookup-only), and nothing is written", () => {
    const id = seed();
    const r = run(id, "none");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("already lookup-only");
    expect(readNote()).toBe(NOTE(LESSON()));
    expect(row().content).toBe(LESSON());
  });

  it("A7: --dry-run reports the addition and writes nothing", () => {
    const id = seed();
    const before = row();
    expect(run(id, VALUE, { dryRun: true })).toMatchObject({ ok: true, before: null, after: ADDED, added: true, unchanged: false, dryRun: true });
    expect(readNote()).toBe(NOTE(LESSON()));
    expect(row()).toEqual(before);
  });
});

describe("T-162 slice A: rematch adds a first MATCH: line (CLI)", () => {
  it("C4: prints the addition and refreshes the trigger key sidecar, which then keys the entry", async () => {
    const id = seed();
    const sidecar = triggerKeysPath(dbPath);
    const db = new Database(dbPath);
    try {
      writeTriggerKeys(db, sidecar);
    } finally {
      db.close();
    }
    expect(JSON.parse(fs.readFileSync(sidecar, "utf-8")).keys).toEqual([]);

    const r = await spawnAsync(process.execPath, [TSX_CLI, CLI, "rematch", "--id", String(id), "--match", VALUE], {
      cwd: dir,
      env: { ...process.env, KNOWLEDGE_V2_DB: dbPath },
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`rematch: entry ${id} (${KEY}) added: "${ADDED}"`);
    expect(r.stdout).toContain("trigger keys: 1 command key(s)");
    expect(JSON.parse(fs.readFileSync(sidecar, "utf-8")).keys.map((k: { id: number }) => k.id)).toEqual([id]);
  }, SPAWN_TIMEOUT);
});
