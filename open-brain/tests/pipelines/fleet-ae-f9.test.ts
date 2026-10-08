import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildingChecksSectionFromRoot,
  checkCursorRulesCurrent,
  writeDeveloperBuildingChecksMdc,
} from "../../src/pipelines/sync/developer-building-checks.js";

const ROOT = join(import.meta.dirname, "../../..");

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

describe("F9: CRLF developer.md does not flap sync", () => {
  let dir: string;
  let savedRole: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fleet-ae-f9-"));
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
    cpSync(join(ROOT, ".agents/SYSTEM/hub-partner-seats.json"), join(dir, ".agents/SYSTEM/hub-partner-seats.json"));
    savedRole = readFileSync(join(ROOT, ".agents/roles/developer.md"), "utf8");
    writeFileSync(join(dir, ".agents/roles/developer.md"), savedRole.replace(/\n/g, "\r\n"));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "T");
    git(dir, "config", "core.autocrlf", "true");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("CRLF developer.md produces an identical .mdc body and cursor-rules-current passes", () => {
    writeDeveloperBuildingChecksMdc(dir);
    const sectionLf = buildingChecksSectionFromRoot(ROOT);
    const sectionCrlf = buildingChecksSectionFromRoot(dir);
    expect(sectionCrlf).toBe(sectionLf);
    expect(checkCursorRulesCurrent(dir).severity).toBe("pass");
    const second = writeDeveloperBuildingChecksMdc(dir);
    expect(second.changed).toBe(false);
  });
});
