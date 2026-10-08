import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describeRoleFiles } from "../../src/pipelines/session-start/role-files.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

describe("A4: role-knowledge names developer.md for a developer seat", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fleet-ae-a4-"));
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    writeFileSync(join(dir, ".agents", "AGENT.md"), "---\nname: Builder\nrole: developer\npartner: Atlas\n---\n\n# Seat\n");
    writeFileSync(join(dir, ".agents", "roles", "developer.md"), "# Developer seat\n\nrules\n");
    writeFileSync(join(dir, ".agents", "roles", "shared.md"), "# shared\n");
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "T");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "seed");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("describeRoleFiles output names developer.md for a developer seat", () => {
    const r = describeRoleFiles(dir, { name: "Builder", role: "developer", partner: "Atlas" });
    const text = r.lines.join("\n");
    expect(text).toContain(".agents/roles/developer.md");
    expect(r.files.some((f) => f.rel.endsWith("developer.md"))).toBe(true);
  });
});
