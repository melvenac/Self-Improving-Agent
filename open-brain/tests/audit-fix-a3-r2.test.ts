import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { VaultPathRefusal, safeVaultPathSegment } from "../src/shared/vault-path-segment.js";
import { yamlScalar } from "../src/shared/yaml-frontmatter.js";
import { writeExperience, parseFrontmatter, type ExperienceInput } from "../src/vault-writer.js";
import { store } from "../src/pipelines/store/index.js";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../src/db-v2.js";

const PROGENITOR_MATURITY = `${"progen"}${"itor"}` as ExperienceInput["maturity"];

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
});

describe("AUDIT-FIX A3 r2 — frontmatter round-trip and path segments", () => {
  it("yamlScalar quotes YAML-retyped values and parseFrontmatter round-trips", () => {
    expect(yamlScalar("-")).toBe('"-"');
    expect(yamlScalar("true")).toBe('"true"');
    expect(yamlScalar("1e3")).toBe('"1e3"');
    expect(yamlScalar("@scope")).toBe('"@scope"');
  });

  it("writeExperience round-trips a key/tag/source with newlines via parseFrontmatter", () => {
    const vault = mkdtempSync(join(tmpdir(), "audit-a3r2-"));
    tmpDirs.push(vault);
    const key = "my\nkey: injected";
    const tag = "tag\nextra: field";
    const source = "manual\nsource: other";
    const path = writeExperience(vault, {
      key,
      tags: [tag],
      content: "body",
      created: "2024-01-01T00:00:00.000Z",
      maturity: PROGENITOR_MATURITY,
      helpful: 0,
      harmful: 0,
      neutral: 0,
      project: "my-project",
      source,
    });
    expect(path).toBeTruthy();
    const fm = parseFrontmatter(readFileSync(path!, "utf-8"));
    expect(fm.key).toBe(key);
    expect(fm.source).toBe(source);
    expect(fm.injected).toBeUndefined();
    expect(fm.extra).toBeUndefined();
    expect(fm.tags).toEqual([tag]);
  });

  it('allows project segments "..." and "..foo" but refuses exact ".." and CON', () => {
    expect(safeVaultPathSegment("project", "...")).toBe("...");
    expect(safeVaultPathSegment("project", "..foo")).toBe("..foo");
    expect(() => safeVaultPathSegment("project", "..")).toThrow(VaultPathRefusal);
    expect(() => safeVaultPathSegment("project", "CON")).toThrow(VaultPathRefusal);
    expect(() => safeVaultPathSegment("project", "C:")).toThrow(VaultPathRefusal);
    expect(() => safeVaultPathSegment("project", "seg:ment")).toThrow(VaultPathRefusal);
  });

  it("writes ..foo under Experiences without escaping the vault root", () => {
    const vault = mkdtempSync(join(tmpdir(), "audit-a3r2b-"));
    tmpDirs.push(vault);
    const path = writeExperience(vault, {
      key: "k",
      tags: [],
      content: "c",
      created: "now",
      maturity: PROGENITOR_MATURITY,
      helpful: 0,
      harmful: 0,
      neutral: 0,
      project: "..foo",
      source: "t",
    });
    expect(path).toContain(join("Experiences", "..foo"));
    expect(existsSync(path!)).toBe(true);
  });

  it("store() path refusal surfaces as VaultPathRefusal for ob_store callers", () => {
    const vault = mkdtempSync(join(tmpdir(), "audit-a3r2c-"));
    tmpDirs.push(vault);
    const db = new Database(":memory:");
    initSchemaV2(db);
    expect(() =>
      store({
        db,
        vaultDir: vault,
        key: "k",
        tags: [],
        content: "c",
        project: "..",
      }),
    ).toThrow(VaultPathRefusal);
    db.close();
  });
});
