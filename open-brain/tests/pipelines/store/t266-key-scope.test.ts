// T-266: `key` is UNIQUE across every scope, so a store whose key a row already holds at a DIFFERENT
// note (another scope, another project, a chunk) is refused before any file is written, rather than
// re-pointing that row to the new note and leaving its own note unindexed.
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
  vault_path: string;
  project_dir: string | null;
  content: string;
};

type Held = { id: number; vaultPath: string; projectDir: string | null } | undefined;

function textOf(res: { content: { text: string }[] }): string {
  return res.content.map((c) => c.text).join("\n");
}

describe("T-266 store pipeline: a key another scope holds is refused", () => {
  let tmp: string;
  let vaultDir: string;
  let db: ReturnType<typeof dbV2.openV2Database>;

  const put = (
    key: string,
    content: string,
    project: string,
    projectDir: string | null = null,
    factKind: "state" | "event" | null = null,
  ) => storePipeline.store({ db, vaultDir, key, tags: ["t266"], content, project, projectDir, factKind });

  const rowsFor = (key: string): Row[] =>
    db.prepare("SELECT id, key, vault_path, project_dir, content FROM knowledge_index WHERE key = ?").all(key) as Row[];

  const note = (project: string, key: string) => vaultWriter.experiencePath(vaultDir, project, key);

  // Read through an untyped view so this file compiles before `keyHeldBy` exists.
  const heldOf = (r: object): Held => (r as { keyHeldBy?: Held }).keyHeldBy;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t266-"));
    vaultDir = fs.mkdtempSync(path.join(tmp, "vault-"));
    db = dbV2.openV2Database(path.join(tmp, "knowledge-v2.db"));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("K1: global, then another project, is refused", () => {
    put("k1-266", "global body", "General");
    const id = rowsFor("k1-266")[0].id;
    const second = put("k1-266", "project body", "Proj-B", "c:/proj/b");

    expect(second.vaultPath).toBeNull();
    expect(heldOf(second)).toEqual({ id, vaultPath: note("General", "k1-266"), projectDir: null });
    expect(fs.existsSync(note("Proj-B", "k1-266"))).toBe(false);

    const rows = rowsFor("k1-266");
    expect(rows).toHaveLength(1);
    expect(rows[0].vault_path).toBe(note("General", "k1-266"));
    expect(rows[0].content).toBe("global body");
    expect(rows[0].project_dir).toBeNull();
  });

  it("K2: a project, then global, is refused", () => {
    put("k2-266", "project body", "Proj-A", "c:/proj/a");
    const second = put("k2-266", "global body", "General");

    expect(heldOf(second)?.projectDir).toBe("c:/proj/a");
    expect(heldOf(second)?.vaultPath).toBe(note("Proj-A", "k2-266"));
    expect(fs.existsSync(note("General", "k2-266"))).toBe(false);

    const rows = rowsFor("k2-266");
    expect(rows).toHaveLength(1);
    expect(rows[0].project_dir).toBe("c:/proj/a");
    expect(rows[0].content).toBe("project body");
  });

  it("K3: a state across two projects is refused, not replaced", () => {
    put("k3-266", "alpha", "Proj-A", "c:/proj/a", "state");
    const second = put("k3-266", "bravo", "Proj-B", "c:/proj/b", "state");

    expect(heldOf(second)).toBeDefined();
    expect(second.replaced).toBeUndefined();
    const raw = fs.readFileSync(note("Proj-A", "k3-266"), "utf-8");
    expect(raw).toContain("alpha");
    expect(raw).not.toContain("## Log");
    expect(rowsFor("k3-266")[0].content).toBe("alpha");
  });

  it("K4: a key held by a chunk-shaped row is refused", () => {
    const chunkPath = path.join(vaultDir, "Checkpoints", "2026-10-13-general-k4-266.md");
    dbV2.indexKnowledge(db, { vaultPath: chunkPath, key: "k4-266", content: "chunk body", tags: "checkpoint", source: "checkpoint" });
    const r = put("k4-266", "experience body", "General");

    expect(heldOf(r)?.vaultPath).toBe(chunkPath);
    expect(fs.existsSync(note("General", "k4-266"))).toBe(false);
    expect(rowsFor("k4-266")[0].content).toBe("chunk body");
  });

  it("K5: the same note, with a path that differs only by case and slashes, is not refused", () => {
    const target = note("General", "k5-266");
    const variant = target.split(path.sep).join("/").toUpperCase();
    dbV2.indexKnowledge(db, { vaultPath: variant, key: "k5-266", content: "old", tags: "" });
    const r = put("k5-266", "new body", "General");

    expect(heldOf(r)).toBeUndefined();
    expect(r.vaultPath).toBe(target);
    const rows = rowsFor("k5-266");
    expect(rows).toHaveLength(1);
    expect(rows[0].vault_path).toBe(target);
    expect(rows[0].content).toBe("new body");
  });

  it("K6: a plain duplicate in the same scope stays the existing dedup", () => {
    put("k6-266", "one", "General");
    const again = put("k6-266", "two", "General");

    expect(again.vaultPath).toBeNull();
    expect(heldOf(again)).toBeUndefined();
  });

  it("K7: storeFailure across projects is refused", () => {
    const base = { db, vaultDir, key: "f7-266", tags: ["t266"], attempted: "a", whyFailed: "w", whatWorked: "x" };
    const first = storePipeline.storeFailure({ ...base, project: "General" });
    const second = storePipeline.storeFailure({ ...base, project: "Proj-B" });

    expect(second.vaultPath).toBeNull();
    expect(heldOf(second)?.vaultPath).toBe(first.vaultPath);
    expect(fs.existsSync(path.join(path.dirname(path.dirname(first.vaultPath!)), "Proj-B", "failure-f7-266.md"))).toBe(false);
  });
});

describe("T-266 ob_store reply (handleStore)", () => {
  let prevVault: string | undefined;
  let vaultDir: string;
  const tag = Math.random().toString(36).slice(2, 8);

  beforeEach(() => {
    prevVault = process.env.OPEN_BRAIN_VAULT_DIR;
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "t266-server-vault-"));
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
  });

  afterEach(() => {
    process.env.OPEN_BRAIN_VAULT_DIR = prevVault;
    fs.rmSync(vaultDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("H1: a project store over a global key is refused and names the entry", async () => {
    const key = `K266-${tag}`;
    const first = textOf(await server.handleStore({ content: "global body t266", key }));
    const id = /\(id: (\d+)\)/.exec(first)?.[1];
    expect(id).toBeTruthy();

    const projDir = fs.mkdtempSync(path.join(os.tmpdir(), "t266-proj-"));
    try {
      const text = textOf(await server.handleStore({ content: "project body t266", key, scope: "project", project_dir: projDir }));
      expect(text).toContain(`Not stored — key "${key}" already belongs to entry ${id} (global) at `);
      expect(text).toContain(`Nothing was written. Store under a different key, or use ob_forget (id: ${id}) first if you meant to move it.`);
      expect(fs.readdirSync(path.join(vaultDir, "Experiences"))).toEqual(["General"]);
    } finally {
      fs.rmSync(projDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
