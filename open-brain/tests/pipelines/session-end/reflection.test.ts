import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { initSchemaV2, indexKnowledge } from "../../../src/db-v2.js";
import { flagReflectionClusters } from "../../../src/pipelines/session-end/reflection.js";

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = new Database(":memory:");
  initSchemaV2(db);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflection-test-"));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function seedKnowledge(tag: string, count: number): void {
  for (let i = 0; i < count; i++) {
    indexKnowledge(db, {
      vaultPath: `/vault/${tag}-${i}.md`,
      key: `${tag}-key-${i}`,
      tags: tag,
      content: `Content for ${tag} entry ${i}`,
    });
  }
}

function insertReflectionLog(
  tag: string,
  result: "approved" | "rejected" | "pending",
  createdAt: string
): void {
  db.prepare(
    `INSERT INTO reflection_log (cluster_tag, source_ids, result, created_at) VALUES (?, ?, ?, ?)`
  ).run(tag, "[]", result, createdAt);
}

describe("flagReflectionClusters", () => {
  it("writes reflection-queue.json when clusters with 3+ entries exist", () => {
    seedKnowledge("auth", 3);
    seedKnowledge("caching", 5);

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);

    expect(result.flagged).toBe(2);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters.map((c) => c.tag).sort()).toEqual(["auth", "caching"]);

    expect(fs.existsSync(queuePath)).toBe(true);
    const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    expect(queue.clusters).toHaveLength(2);
    expect(queue.created_at).toBeTruthy();
    expect(typeof queue.created_at).toBe("string");
  });

  it("skips clusters already approved", () => {
    seedKnowledge("auth", 4);
    seedKnowledge("db", 3);

    insertReflectionLog("auth", "approved", new Date().toISOString());

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);

    expect(result.flagged).toBe(1);
    expect(result.clusters[0].tag).toBe("db");
    const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    expect(queue.clusters).toHaveLength(1);
    expect(queue.clusters[0].tag).toBe("db");
  });

  it("skips clusters rejected within 30 days", () => {
    seedKnowledge("auth", 3);
    seedKnowledge("db", 3);

    // Rejected 5 days ago — within window
    const recentRejection = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    insertReflectionLog("auth", "rejected", recentRejection);

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);

    expect(result.flagged).toBe(1);
    expect(result.clusters[0].tag).toBe("db");
  });

  it("includes clusters rejected more than 30 days ago", () => {
    seedKnowledge("auth", 3);

    // Rejected 31 days ago — outside window, eligible again
    const oldRejection = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    insertReflectionLog("auth", "rejected", oldRejection);

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);

    expect(result.flagged).toBe(1);
    expect(result.clusters[0].tag).toBe("auth");
  });

  it("returns 0 flagged and does not create file when no clusters meet threshold", () => {
    seedKnowledge("auth", 2); // only 2 — below threshold

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);

    expect(result.flagged).toBe(0);
    expect(result.clusters).toHaveLength(0);
    expect(fs.existsSync(queuePath)).toBe(false);
  });

  it("returns 0 and does not create file when all eligible clusters are filtered out", () => {
    seedKnowledge("auth", 3);

    insertReflectionLog("auth", "approved", new Date().toISOString());

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    const result = flagReflectionClusters(db, queuePath);

    expect(result.flagged).toBe(0);
    expect(result.clusters).toHaveLength(0);
    expect(fs.existsSync(queuePath)).toBe(false);
  });

  it("queue file contains correct tag and count", () => {
    seedKnowledge("typescript", 4);

    const queuePath = path.join(tmpDir, "reflection-queue.json");
    flagReflectionClusters(db, queuePath);

    const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    expect(queue.clusters[0].tag).toBe("typescript");
    expect(queue.clusters[0].count).toBe(4);
  });
});
