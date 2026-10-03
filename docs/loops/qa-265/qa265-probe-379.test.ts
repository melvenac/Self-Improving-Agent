// QA 265 probe for #379, run from open-brain/tests/pipelines/sync/ at 89ab68b2: 3/3 passed.
// P1 warn "not checked: mcpServers (.mcp.json): entry is not an object"; P2 warn names "project /p: entry is a string";
// P3 warn names "<home>/.claude.json: top level is null, not an object".
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkMcpCommandPaths } from "../../../src/pipelines/sync/checks.js";

describe("QA 265 probes: T-231 edges", () => {
  let home: string;
  let repo: string;
  let bin: string;
  const env = () => ({ pathEnv: bin, pathExt: ".CMD;.EXE" });
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "qa265-home-"));
    repo = mkdtempSync(join(tmpdir(), "qa265-repo-"));
    bin = mkdtempSync(join(tmpdir(), "qa265-bin-"));
    const file = join(bin, "goodserver");
    writeFileSync(file, "#!/bin/sh\n");
    chmodSync(file, 0o755);
    writeFileSync(join(home, ".claude.json"), JSON.stringify({ mcpServers: { good: { command: file } } }));
  });
  afterEach(() => {
    for (const d of [home, repo, bin]) rmSync(d, { recursive: true, force: true });
  });
  const run = () => checkMcpCommandPaths(home, env(), repo);

  it("P1: checkout .mcp.json with mcpServers: null", () => {
    writeFileSync(join(repo, ".mcp.json"), JSON.stringify({ mcpServers: null }));
    const r = run();
    expect(r.severity).not.toBe("pass");
  });

  it("P2: a project entry that is a string", () => {
    writeFileSync(join(home, ".claude.json"), JSON.stringify({ mcpServers: { good: { command: join(bin, "goodserver") } }, projects: { "/p": "oops" } }));
    const r = run();
    expect(r.message).toContain("project /p: entry is a string, not an object");
  });

  it("P3: ~/.claude.json top level is null", () => {
    writeFileSync(join(repo, ".mcp.json"), JSON.stringify({ mcpServers: { good: { command: join(bin, "goodserver") } } }));
    writeFileSync(join(home, ".claude.json"), "null");
    const r = run();
    expect(r.severity).toBe("warn");
    expect(r.message).toContain("top level is null, not an object");
  });
});
