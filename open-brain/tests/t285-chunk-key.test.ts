import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { handleStore, handleStoreChunk } from "../src/server.js";
import { slugify } from "../src/vault-writer.js";

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
});
