import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkMcpCommandPaths, resolveMcpCommand } from "../../../src/pipelines/sync/checks.js";

/**
 * T-008: every MCP server `command` in ~/.claude.json must exist. Fixture config files and an
 * injected PATH only; the machine's real ~/.claude.json and PATH are never read here.
 */
describe("checkMcpCommandPaths (T-008)", () => {
  let home: string;
  let bin: string;
  const win = process.platform === "win32";
  const env = () => ({ pathEnv: bin, pathExt: ".CMD;.EXE" });

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "t008-home-"));
    bin = mkdtempSync(join(tmpdir(), "t008-bin-"));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  function config(c: unknown): void {
    writeFileSync(join(home, ".claude.json"), JSON.stringify(c));
  }
  /** An executable on the injected PATH: `name.cmd` on Windows, `name` (mode 755) elsewhere. */
  function onPath(name: string): string {
    const file = join(bin, win ? `${name}.cmd` : name);
    writeFileSync(file, win ? "@echo off\r\n" : "#!/bin/sh\n");
    chmodSync(file, 0o755);
    return file;
  }

  it("row 1: the GitNexus case, an absolute path that does not exist, is an ISSUE naming the server and the path", () => {
    const missing = win ? "C:\\Program Files\\nodejs\\gitnexus.cmd" : "/usr/local/nowhere/gitnexus.cmd";
    config({ mcpServers: { gitnexus: { type: "stdio", command: missing, args: ["mcp"] } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("gitnexus");
    expect(r.message).toContain(missing);
  });

  it("an absolute path that exists passes", () => {
    const real = onPath("realserver");
    config({ mcpServers: { real: { command: real } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("1 MCP server command(s) resolve");
  });

  it("row 2: a bare name present on PATH passes (on Windows through PATHEXT)", () => {
    onPath("goodserver");
    config({ mcpServers: { good: { command: "goodserver" } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("pass");
  });

  it("row 3: a bare name absent from PATH is an ISSUE naming the server and the command", () => {
    config({ mcpServers: { ghost: { command: "no-such-server-anywhere" } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("ghost: no-such-server-anywhere not found");
  });

  it("row 4: a url server is skipped with its reason, and does not hide a missing command next to it", () => {
    onPath("goodserver");
    config({ mcpServers: { remote: { type: "http", url: "https://example.invalid/mcp" }, good: { command: "goodserver" } } });
    const ok = checkMcpCommandPaths(home, env());
    expect(ok.severity, ok.message).toBe("pass");
    expect(ok.message).toContain("remote (global): url server, no command to stat");

    config({ mcpServers: { remote: { type: "http", url: "https://example.invalid/mcp" }, ghost: { command: "no-such-server-anywhere" } } });
    const bad = checkMcpCommandPaths(home, env());
    expect(bad.severity).toBe("issue");
    expect(bad.message).toContain("remote (global): url server");
  });

  it("a config with only url servers is SKIPPED, not passed", () => {
    config({ mcpServers: { remote: { type: "http", url: "https://example.invalid/mcp" } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^not checked: no mcpServers entry with a command/);
  });

  it("row 5: a missing config is 'not checked', never a pass", () => {
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^not checked: .*\.claude\.json does not exist\. This is not a pass\./);
  });

  it("an unreadable config (invalid JSON) is 'not checked' with the cause", () => {
    writeFileSync(join(home, ".claude.json"), "{ not json");
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity).toBe("skip");
    expect(r.message).toMatch(/^not checked: .*could not be read as JSON/);
  });

  it("per-project servers are checked too, and the project is named", () => {
    config({ mcpServers: {}, projects: { "C:/work/proj": { mcpServers: { ghost: { command: "no-such-server-anywhere" } } } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("project C:/work/proj");
  });

  // B2 ruling (QA 256 row 5): ANY input that was not checked caps the result at WARN, never pass,
  // even when the message names the skip.
  it("a command using ${...} expansion beside a good one is WARN 'not checked', not pass", () => {
    config({ mcpServers: { x: { command: "${TOOLS}/server" }, good: { command: onPath("goodserver") } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("warn");
    expect(r.message).toContain("Not checked 1: x (global): command uses ${...} expansion");
    expect(r.message).toContain("not a full pass");
  });

  it("QA's mixed fixture: a non-string command beside a good one is WARN, not pass", () => {
    config({ mcpServers: { y: { command: ["node", "x.js"] }, good: { command: onPath("goodserver") } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("warn");
    expect(r.message).toContain("Not checked 1: y (global): no command and no url");
  });

  it("no command and no url beside a good one is WARN, not pass", () => {
    config({ mcpServers: { z: {}, good: { command: onPath("goodserver") } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("warn");
    expect(r.message).toContain("z (global): no command and no url");
  });

  it("QA 260: a NON-OBJECT or null mcpServers entry beside a good one is WARN, and names the server key", () => {
    for (const bad of [null, "a string", 7]) {
      config({ mcpServers: { broken: bad, good: { command: onPath("goodserver") } } });
      const r = checkMcpCommandPaths(home, env());
      expect(r.severity, r.message).toBe("warn");
      expect(r.message).toContain("Not checked 1: broken (global): entry is not an object");
    }
  });

  it("a url server beside a good command is still a pass: it has no command to stat, by design", () => {
    config({ mcpServers: { remote: { url: "https://example.invalid/mcp" }, good: { command: onPath("goodserver") } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("remote (global): url server");
  });

  it("a missing command still outranks the warn: ISSUE, with the not-checked servers named", () => {
    config({ mcpServers: { x: { command: "${TOOLS}/server" }, ghost: { command: "no-such-server-anywhere" } } });
    const r = checkMcpCommandPaths(home, env());
    expect(r.severity, r.message).toBe("issue");
    expect(r.message).toContain("Not checked 1");
  });

  it("resolveMcpCommand: an empty PATH finds nothing, and a directory is not a command", () => {
    mkdirSync(join(bin, "adir"));
    expect(resolveMcpCommand("adir", { pathEnv: bin, pathExt: ".CMD" })).toBeNull();
    expect(resolveMcpCommand("anything", { pathEnv: "", pathExt: ".CMD" })).toBeNull();
  });
});
