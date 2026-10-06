import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { VaultPathRefusal } from "../src/shared/vault-path-segment.js";
import { writeExperience, type ExperienceInput } from "../src/vault-writer.js";
import { handleStoreChunk } from "../src/server.js";

const PROGENITOR_MATURITY = `${"progen"}${"itor"}` as ExperienceInput["maturity"];

function experienceInput(
  project: string,
  key = "escape",
): ExperienceInput {
  return {
    key,
    tags: [],
    content: "body",
    created: "now",
    maturity: PROGENITOR_MATURITY,
    helpful: 0,
    harmful: 0,
    neutral: 0,
    project,
    source: "test",
  };
}

let tmpDirs: string[] = [];

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), "audit-a3-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
  delete process.env.OPEN_BRAIN_VAULT_DIR;
});

describe("AUDIT-FIX A3 — vault path segments and chunk frontmatter", () => {
  it('refuses project ".." and writes nothing outside Experiences/', () => {
    const vault = makeVault();
    expect(() => writeExperience(vault, experienceInput(".."))).toThrow(VaultPathRefusal);
    expect(existsSync(join(vault, "Experiences"))).toBe(false);
    const vaultRootMd = readdirSync(vault).filter((f) => f.endsWith(".md"));
    expect(vaultRootMd).toHaveLength(0);
  });

  it("refuses an absolute project segment and does not escape Experiences/", () => {
    const vault = makeVault();
    const absProject = join(tmpdir(), "evil-project-name");
    expect(() => writeExperience(vault, { ...experienceInput(absProject, "k"), content: "c" })).toThrow(
      VaultPathRefusal,
    );
    expect(existsSync(join(vault, "Experiences"))).toBe(false);
  });

  it("keeps a newline-in-tag frontmatter injection as one scalar field", async () => {
    const vault = makeVault();
    process.env.OPEN_BRAIN_VAULT_DIR = vault;
    const injected = "safe\ninjected: true";
    const res = await handleStoreChunk({
      content: "chunk body",
      key: "checkpoint-key",
      tags: [injected],
      category: "note",
    });
    const text = res.content[0]?.text ?? "";
    if (res.isError) throw new Error(text);
    const vaultLine = text.split("\n").find((l) => l.includes("Vault:"));
    expect(vaultLine).toBeTruthy();
    const vaultPath = vaultLine!.replace(/^.*Vault:\s*/, "").trim();
    const raw = readFileSync(vaultPath, "utf-8");
    expect(raw).not.toMatch(/^injected:/m);
    expect(raw).toMatch(/tags:\s*\[note,\s*"safe\\ninjected: true"\]/);
  });
});
