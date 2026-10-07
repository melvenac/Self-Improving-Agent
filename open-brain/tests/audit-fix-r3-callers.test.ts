import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import { parseFrontmatterScalar, parseInlineArray, parseFrontmatter } from "../src/shared/parse-frontmatter.js";
import { yamlScalar } from "../src/shared/yaml-frontmatter.js";
import { initSchemaV2 } from "../src/db-v2.js";
import { sessionEndV2 } from "../src/pipelines/session-end/index-v2.js";

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
});

describe("AUDIT-FIX r3 caller regressions", () => {
  it("topics: quoted project frontmatter unquotes before slugify", () => {
    const raw = yamlScalar("My Project");
    const slug = parseFrontmatterScalar(raw).trim().toLowerCase().replace(/\s+/g, "-");
    expect(slug).toBe("my-project");
    expect(slug).not.toContain("\\");
  });

  it("parseInlineArray: malformed tags line does not throw", () => {
    expect(parseInlineArray('alpha, "broken')).toEqual(['alpha, "broken']);
    const fm = parseFrontmatter(`---\ntags: [alpha, "broken]\n---\n\nbody\n`);
    expect(Array.isArray(fm.tags)).toBe(true);
  });

  it("session end: reserved project name still writes summary as General", () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r3-end-"));
    tmpDirs.push(td);
    const vault = join(td, "vault");
    mkdirSync(vault, { recursive: true });
    const db = new Database(":memory:");
    initSchemaV2(db);

    sessionEndV2({
      db,
      vaultDir: vault,
      agentsDir: join(td, ".agents"),
      sessionId: "sess-1",
      sessionSummary: "Did things.",
      project: "CON",
      recalledEntryIds: [],
      dryRun: false,
    });

    const summaries = join(vault, "Summaries");
    expect(existsSync(summaries)).toBe(true);
    const file = readdirSync(summaries)[0]!;
    const content = readFileSync(join(summaries, file), "utf-8");
    expect(content).toContain("project: General");
    db.close();
  });
});
