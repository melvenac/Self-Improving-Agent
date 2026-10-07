import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../src/db-v2.js";
import { planTopics } from "../src/pipelines/topics/index.js";
import { yamlInlineArray } from "../src/shared/yaml-frontmatter.js";

let tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  tmpDirs = [];
});

describe("AUDIT-FIX r4 — topics tags unquoting", () => {
  it('readSummaries unquotes JSON tags like project (e.g. "My Topic")', () => {
    const td = mkdtempSync(join(tmpdir(), "audit-r4-topics-"));
    tmpDirs.push(td);
    const vault = join(td, "vault");
    const summaries = join(vault, "Summaries");
    mkdirSync(summaries, { recursive: true });
    const tag = "My Topic";
    writeFileSync(
      join(summaries, "2026-01-01-demo.md"),
      `---\nproject: demo\ntags: ${yamlInlineArray([tag, "session-summary"])}\n---\n\nbody\n`,
      "utf-8",
    );

    const db = new Database(":memory:");
    initSchemaV2(db);
    const plan = planTopics(db, vault, { min: 1 });
    const topic = plan.find((p) => p.tag === "my topic");
    expect(topic).toBeTruthy();
    db.close();
  });
});
