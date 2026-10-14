import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { handleStore, handleStoreChunk } from "../src/server.js";
import { slugify } from "../src/vault-writer.js";
import * as dbV2 from "../src/db-v2.js";

// T-285: ob_store_chunk refuses a key or a vault file another entry already holds, before writing anything.

type R = Awaited<ReturnType<typeof handleStoreChunk>>;
const text = (r: R) => r.content[0]?.text ?? "";

let tmpDirs: string[] = [];
const savedVault = process.env.OPEN_BRAIN_VAULT_DIR;

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), "t285-"));
  tmpDirs.push(dir);
  process.env.OPEN_BRAIN_VAULT_DIR = dir;
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
  if (savedVault === undefined) delete process.env.OPEN_BRAIN_VAULT_DIR;
  else process.env.OPEN_BRAIN_VAULT_DIR = savedVault;
});

describe("T-285 — ob_store_chunk refuses a held key or file", () => {
  it("K1: a chunk over an ob_store key is refused, and no file is written", async () => {
    const vault = makeVault();
    const tag = Math.random().toString(36).slice(2, 8);
    const key = `K285-${tag}`;
    const stored = await handleStore({ content: "experience body t285", key });
    const m = text(stored).match(/\(id: (\d+)\)/);
    expect(m, text(stored)).toBeTruthy();
    const id = m![1];

    const r = await handleStoreChunk({ content: "chunk body", key, category: "note" });
    expect(r.isError, text(r)).toBe(true);
    expect(text(r)).toContain(`ob_store_chunk refused: key "${key}" already belongs to entry ${id} (global)`);
    expect(text(r)).toContain("Nothing was written.");

    const chunks = join(vault, "Chunks");
    const slug = slugify(key);
    const files = existsSync(chunks) ? readdirSync(chunks).filter((f) => f.includes(slug)) : [];
    expect(files).toEqual([]);
  });

  it("K2: a second chunk with the same key is refused", async () => {
    makeVault();
    const tag = Math.random().toString(36).slice(2, 8);
    const key = `C285-${tag}`;
    const first = await handleStoreChunk({ content: "first content", key, category: "note" });
    expect(first.isError, text(first)).toBeFalsy();
    const vaultPath = text(first).split("\n").find((l) => l.includes("Vault:"))!.replace(/^.*Vault:\s*/, "").trim();

    const r = await handleStoreChunk({ content: "second content", key, category: "note" });
    expect(r.isError, text(r)).toBe(true);
    expect(text(r)).toContain("already belongs to entry");
    const raw = readFileSync(vaultPath, "utf-8");
    expect(raw).toContain("first content");
    expect(raw).not.toContain("second content");
  });

  it("K3: an orphan file at the chunk's path is refused, and kept byte for byte", async () => {
    const vault = makeVault();
    const tag = Math.random().toString(36).slice(2, 8);
    const key = `O285-${tag}`;
    const today = new Date().toISOString().slice(0, 10);
    const chunks = join(vault, "Chunks");
    mkdirSync(chunks, { recursive: true });
    const orphan = join(chunks, `${today}-general-${slugify(key)}.md`);
    writeFileSync(orphan, "orphan\n", "utf-8");

    const r = await handleStoreChunk({ content: "x", key, category: "note" });
    expect(r.isError, text(r)).toBe(true);
    expect(text(r)).toContain("is already on disk as a file no entry indexes");
    expect(readFileSync(orphan, "utf-8")).toBe("orphan\n");
  });

  it("K4: a fresh key still stores", async () => {
    makeVault();
    const tag = Math.random().toString(36).slice(2, 8);
    const r = await handleStoreChunk({ content: "fresh body", key: `F285-${tag}`, category: "note" });
    expect(r.isError, text(r)).toBeFalsy();
    expect(text(r).startsWith("Chunk stored (id: ")).toBe(true);
  });

  it("K5: two keys that slugify to one file: the second is refused naming the first entry", async () => {
    makeVault();
    const tag = Math.random().toString(36).slice(2, 8);
    expect(slugify(`Foo Bar ${tag}`)).toBe(slugify(`foo-bar-${tag}`));
    const first = await handleStoreChunk({ content: "one", key: `Foo Bar ${tag}`, category: "note" });
    expect(first.isError, text(first)).toBeFalsy();
    const m = text(first).match(/\(id: (\d+)\)/);
    expect(m, text(first)).toBeTruthy();
    const id = m![1];

    const second = await handleStoreChunk({ content: "two", key: `foo-bar-${tag}`, category: "note" });
    expect(second.isError, text(second)).toBe(true);
    expect(text(second)).toContain(`is already indexed as entry ${id} (key "Foo Bar ${tag}")`);
  });

  it("K6: a row holding the same file in another case and slash form, with no file on disk, is refused", async () => {
    const vault = makeVault();
    const tag = Math.random().toString(36).slice(2, 8);
    const key = `K6-${tag}`;
    const today = new Date().toISOString().slice(0, 10);
    const computed = join(vault, "Chunks", `${today}-general-${slugify(key)}.md`);
    const variant = computed.split("\\").join("/").toUpperCase();
    const db = dbV2.openV2Database(process.env.KNOWLEDGE_V2_DB!);
    try {
      dbV2.indexKnowledge(db, { vaultPath: variant, key: `K6-${tag}-holder`, content: "holder", tags: "" });
      const holderId = (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(`K6-${tag}-holder`) as { id: number }).id;

      const r = await handleStoreChunk({ content: "x", key, category: "note" });
      expect(r.isError, text(r)).toBe(true);
      expect(text(r)).toContain(`is already indexed as entry ${holderId} (key "K6-${tag}-holder")`);
      expect(existsSync(computed)).toBe(false);
    } finally {
      db.close();
    }
  });
});
