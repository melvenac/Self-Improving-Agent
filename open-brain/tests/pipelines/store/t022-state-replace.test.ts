// T-022: a `state` fact stored again under the same key replaces its value; the old value moves to
// the note's `## Log`. Everything else (event, unlabelled, a non-state predecessor, another key on
// the same note path) is refused exactly as before.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as dbV2 from "../../../src/db-v2.js";
import * as storePipeline from "../../../src/pipelines/store/index.js";
import * as vaultWriter from "../../../src/vault-writer.js";
import * as server from "../../../src/server.js";

type Row = {
  id: number;
  key: string;
  content: string;
  fact_kind: string | null;
  archived_into: number | null;
  created_at: string;
  vault_path: string;
};

function rowsFor(db: ReturnType<typeof dbV2.openV2Database>, key: string): Row[] {
  return db.prepare("SELECT * FROM knowledge_index WHERE key = ?").all(key) as Row[];
}

function ftsIds(db: ReturnType<typeof dbV2.openV2Database>, token: string): number[] {
  return (db.prepare("SELECT rowid AS id FROM knowledge_fts WHERE knowledge_fts MATCH ?").all(token) as { id: number }[])
    .map((r) => r.id);
}

function createdOf(note: string): unknown {
  return vaultWriter.parseFrontmatter(fs.readFileSync(note, "utf-8")).created;
}

function textOf(res: { content: { text: string }[] }): string {
  return res.content.map((c) => c.text).join("\n");
}

describe("T-022 store pipeline: state replace", () => {
  let tmp: string;
  let vaultDir: string;
  let db: ReturnType<typeof dbV2.openV2Database>;

  const put = (key: string, content: string, factKind?: "state" | "event" | null) =>
    storePipeline.store({ db, vaultDir, key, tags: ["t022"], content, project: "General", factKind: factKind ?? null });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t022-"));
    vaultDir = fs.mkdtempSync(path.join(tmp, "vault-"));
    db = dbV2.openV2Database(path.join(tmp, "knowledge-v2.db"));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("R1: a second state under the same key updates the same row, and the old text leaves FTS", () => {
    const first = put("k1-state", "alphatokenr1", "state");
    expect(first.vaultPath).not.toBeNull();
    const before = rowsFor(db, "k1-state");
    expect(before).toHaveLength(1);

    const second = put("k1-state", "bravotokenr1", "state");
    expect(second.replaced?.id).toBe(before[0].id);

    const after = rowsFor(db, "k1-state");
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].content).toBe("bravotokenr1");
    expect(after[0].fact_kind).toBe("state");
    expect(after[0].archived_into).toBeNull();
    expect(after[0].created_at).toBe(before[0].created_at);
    expect(ftsIds(db, "alphatokenr1")).toEqual([]);
    expect(ftsIds(db, "bravotokenr1")).toEqual([before[0].id]);
    expect((db.prepare("SELECT COUNT(*) AS n FROM knowledge_index").get() as { n: number }).n).toBe(1);
  });

  it("R2: a, b, c leaves c current, one ## Log, b's block above a's, and the first created", () => {
    const first = put("k2-state", "avaluer2", "state");
    const note = first.vaultPath!;
    const created = createdOf(note);
    put("k2-state", "bvaluer2", "state");
    put("k2-state", "cvaluer2", "state");

    const raw = fs.readFileSync(note, "utf-8");
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
    const { current, log } = vaultWriter.splitStateLog(body);
    expect(current.trim()).toBe("cvaluer2");
    expect(raw.match(/^## Log$/gm)).toHaveLength(1);
    const blocks = [...log.matchAll(/^### Replaced (\S+)$/gm)];
    expect(blocks).toHaveLength(2);
    for (const b of blocks) expect(new Date(b[1]).toISOString()).toBe(b[1]);
    expect(log.indexOf("bvaluer2")).toBeGreaterThan(-1);
    expect(log.indexOf("bvaluer2")).toBeLessThan(log.indexOf("avaluer2"));
    expect(log).not.toContain("cvaluer2");
    expect(createdOf(note)).toBe(created);
    expect(rowsFor(db, "k2-state")[0].content).toBe("cvaluer2");
  });

  it("R3: a repeated event key is refused; a no-kind store over a state is refused", () => {
    put("k2-event", "xvaluer3", "event");
    const again = put("k2-event", "yvaluer3", "event");
    expect(again.vaultPath).toBeNull();
    expect(again.replaced).toBeUndefined();
    expect(rowsFor(db, "k2-event")[0].content).toBe("xvaluer3");

    put("k3-state", "firstr3", "state");
    const noKind = put("k3-state", "secondr3");
    expect(noKind.vaultPath).toBeNull();
    expect(noKind.replaced).toBeUndefined();
    expect(rowsFor(db, "k3-state")[0].content).toBe("firstr3");
  });

  it("R4: a state over an event is refused and names it; another key on the same note path is refused", () => {
    put("k4-kind", "eventvaluer4", "event");
    const over = put("k4-kind", "statevaluer4", "state");
    expect(over.vaultPath).toBeNull();
    expect(over.replaced).toBeUndefined();
    expect(over.existingKind).toBe("event");
    const row = rowsFor(db, "k4-kind")[0];
    expect(row.fact_kind).toBe("event");
    expect(row.content).toBe("eventvaluer4");

    put("Foo Bar", "foobarfirst", "state");
    const other = put("foo-bar", "foobarsecond", "state");
    expect(other.vaultPath).toBeNull();
    expect(other.replaced).toBeUndefined();
    expect(rowsFor(db, "Foo Bar")[0].content).toBe("foobarfirst");
    expect(rowsFor(db, "foo-bar")).toHaveLength(0);
  });

  it("R5: the same value twice is unchanged and the note's bytes are untouched", () => {
    const first = put("k5-state", "samevaluer5", "state");
    const bytes = fs.readFileSync(first.vaultPath!);
    const again = put("k5-state", "  samevaluer5\n", "state");
    expect(again.unchanged).toBe(true);
    expect(again.replaced).toBeUndefined();
    const now = fs.readFileSync(first.vaultPath!);
    expect(now.equals(bytes)).toBe(true);
    expect(now.toString("utf-8")).not.toContain("## Log");
  });

  for (const [label, eol, bom] of [["LF", "\n", ""], ["CRLF", "\r\n", "﻿"]] as const) {
    it(`R7: adopting a hand-written ${label} note that has a ## Log indexes only its current value`, () => {
      const key = `k7-${label.toLowerCase()}`;
      const note = vaultWriter.experiencePath(vaultDir, "General", key);
      fs.mkdirSync(path.dirname(note), { recursive: true });
      const lines = [
        "---", `key: ${key}`, "tags: [t022]", "---", "",
        `currentvaluer7${label.toLowerCase()}`, "",
        "## Log", "",
        "### Replaced 2026-10-01T00:00:00.000Z", "",
        `oldvaluer7${label.toLowerCase()}`, "",
      ];
      fs.writeFileSync(note, bom + lines.join(eol), "utf-8");

      const res = put(key, "ignored-by-adoption", "state");
      expect(res.adopted).toBe(true);
      const row = rowsFor(db, key)[0];
      expect(row.content).toBe(`currentvaluer7${label.toLowerCase()}`);
      expect(ftsIds(db, `oldvaluer7${label.toLowerCase()}`)).toEqual([]);
    });
  }
});

describe("T-022 ob_store replies (handleStore)", () => {
  let prevVault: string | undefined;
  let vaultDir: string;
  const tag = Math.random().toString(36).slice(2, 8);

  beforeEach(() => {
    prevVault = process.env.OPEN_BRAIN_VAULT_DIR;
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "t022-server-vault-"));
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
  });

  afterEach(() => {
    process.env.OPEN_BRAIN_VAULT_DIR = prevVault;
    fs.rmSync(vaultDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("R6: a replaced state replies Replaced, the old value is not recalled, a repeated event is still Not stored", async () => {
    const key = `K6-${tag}`;
    const oldToken = `oldtokenr6${tag}`;
    const first = textOf(await server.handleStore({ content: `${oldToken} value`, key, kind: "state" }));
    const id = /\(id: (\d+)\)/.exec(first)?.[1];
    expect(id).toBeTruthy();

    const second = textOf(await server.handleStore({ content: `newtokenr6${tag} value`, key, kind: "state" }));
    expect(second).toContain(`Replaced state "${key}" (id: ${id})`);
    expect(second).toContain('the previous value moved to "## Log"');

    const recall = textOf(await server.handleRecall({ queries: [oldToken], global: true }));
    expect(recall).toContain("No results found.");
    expect(recall).not.toContain(`(id: ${id})`);

    const same = textOf(await server.handleStore({ content: `newtokenr6${tag} value`, key, kind: "state" }));
    expect(same).toContain(`Unchanged — state "${key}" (id: ${id}) already holds this value. Nothing was written.`);

    const ev = `K6e-${tag}`;
    await server.handleStore({ content: "event one", key: ev, kind: "event" });
    const evAgain = textOf(await server.handleStore({ content: "event two", key: ev, kind: "event" }));
    expect(evAgain).toContain("Not stored —");
  });

  it("R4 reply: a state over an event names the existing kind", async () => {
    const key = `K4r-${tag}`;
    await server.handleStore({ content: "an event", key, kind: "event" });
    const over = textOf(await server.handleStore({ content: "a state", key, kind: "state" }));
    expect(over).toContain("Not stored —");
    expect(over).toContain('It is stored as event; kind "state" replaces only a state.');

    const unl = `K4u-${tag}`;
    await server.handleStore({ content: "unlabelled", key: unl });
    const overUnl = textOf(await server.handleStore({ content: "a state", key: unl, kind: "state" }));
    expect(overUnl).toContain('It is stored as unlabelled; kind "state" replaces only a state.');
  });
});
