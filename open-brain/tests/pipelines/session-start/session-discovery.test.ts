import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deriveProjectKey, discoverSessionUuid } from "../../../src/pipelines/session-start/session-discovery.js";

describe("deriveProjectKey", () => {
  it("converts Windows path to project key", () => {
    const key = deriveProjectKey("C:\\Users\\melve\\Projects\\Foo");
    expect(key).toBe("C--Users-melve-Projects-Foo");
  });

  it("handles forward slashes", () => {
    const key = deriveProjectKey("C:/Users/melve/Projects/Foo");
    expect(key).toBe("C--Users-melve-Projects-Foo");
  });
});

describe("discoverSessionUuid", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "ob-discover-"));
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("finds the newest UUID-shaped JSONL file", () => {
    const projectDir = join(tempHome, ".claude", "projects", "C--Users-melve-Projects-Foo");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl"), "");
    writeFileSync(join(projectDir, "11111111-2222-3333-4444-555555555555.jsonl"), "");

    const uuid = discoverSessionUuid("C:\\Users\\melve\\Projects\\Foo", tempHome);
    expect(uuid).toBeTruthy();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns null when project directory does not exist", () => {
    const uuid = discoverSessionUuid("C:\\Users\\melve\\Projects\\Nonexistent", tempHome);
    expect(uuid).toBeNull();
  });

  it("returns null when no UUID-shaped files exist", () => {
    const projectDir = join(tempHome, ".claude", "projects", "C--Users-melve-Projects-Foo");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, "memory"));
    writeFileSync(join(projectDir, "not-a-uuid.jsonl"), "");

    const uuid = discoverSessionUuid("C:\\Users\\melve\\Projects\\Foo", tempHome);
    expect(uuid).toBeNull();
  });

  it("handles case-insensitive directory matching", () => {
    const projectDir = join(tempHome, ".claude", "projects", "c--Users-melve-Projects-Foo");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl"), "");

    const uuid = discoverSessionUuid("C:\\Users\\melve\\Projects\\Foo", tempHome);
    expect(uuid).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
});
