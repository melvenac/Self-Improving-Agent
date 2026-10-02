import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkHookConfigs, checkHookRegistration, checkVaultPathRefs } from "../../../src/pipelines/sync/checks.js";

/**
 * T-048 (sync checks): a filter that drops rows must say how many. Each check below used to
 * print an unqualified pass whatever number of entries it actually read, so zero read looked
 * the same as everything read. Every row names the count it expects.
 */
describe("T-048 sync counts", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t048-counts-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  const settings = (obj: unknown): string => {
    const p = join(dir, "settings.json");
    writeFileSync(p, JSON.stringify(obj), "utf-8");
    return p;
  };

  describe("hook-configs", () => {
    // Real files on disk, so "exists" is a stat and not a string compare. One path has a space in it.
    let scripts: string;
    let spaced: string;
    beforeEach(() => {
      scripts = join(dir, "scripts");
      spaced = join(dir, "dir with space");
      mkdirSync(scripts, { recursive: true });
      mkdirSync(spaced, { recursive: true });
      writeFileSync(join(scripts, "boot.js"), "");
      writeFileSync(join(scripts, "end.js"), "");
      writeFileSync(join(spaced, "x.js"), "");
      writeFileSync(join(scripts, "runner.exe"), "");
    });
    const fwd = (p: string) => p.replace(/\\/g, "/");
    const group = (...commands: string[]) => ({ matcher: "Bash", hooks: commands.map((command) => ({ type: "command", command })) });

    it("walks event -> matcher group -> hooks[] -> command, and stats each one (the real settings.json shape)", () => {
      const p = settings({
        hooks: {
          SessionStart: [group(`node "${fwd(join(scripts, "boot.js"))}"`)],
          SessionEnd: [group(`node ${fwd(join(scripts, "end.js"))}`)],
        },
      });
      const r = checkHookConfigs(p);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("2 hook command file(s) checked; skipped 0");
      expect(r.message).toContain("of 2 entries");
    });

    it("a missing script behind a matcher group is a FAIL naming the path", () => {
      const gone = fwd(join(scripts, "gone.js"));
      const p = settings({ hooks: { SessionStart: [group(`node "${gone}"`, `node "${fwd(join(scripts, "boot.js"))}"`)] } });
      const r = checkHookConfigs(p);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain(gone);
      expect(r.message).toContain("2 hook command file(s) checked");
    });

    it("a quoted path with spaces is one argument, found when present and named when absent", () => {
      const ok = checkHookConfigs(settings({ hooks: { A: [group(`node "${fwd(join(spaced, "x.js"))}"`)] } }));
      expect(ok.severity, ok.message).toBe("pass");
      const missingPath = fwd(join(spaced, "nope.js"));
      const bad = checkHookConfigs(settings({ hooks: { A: [group(`node "${missingPath}"`)] } }));
      expect(bad.severity).toBe("issue");
      expect(bad.message).toContain(missingPath);
    });

    it("a quoted node binary as the head: the SCRIPT after it is stat'ed; any other path head is itself the file", () => {
      const nodeBin = join(scripts, "node.exe");
      writeFileSync(nodeBin, "");
      const viaNode = checkHookConfigs(settings({ hooks: { A: [group(`"${fwd(nodeBin)}" "${fwd(join(scripts, "missing-after-node.js"))}"`)] } }));
      expect(viaNode.severity).toBe("issue");
      expect(viaNode.message).toContain("missing-after-node.js");
      expect(checkHookConfigs(settings({ hooks: { A: [group(`"${fwd(join(scripts, "runner.exe"))}" --arg`)] } })).severity).toBe("pass");
      const gone = fwd(join(scripts, "gone.exe"));
      const headMissing = checkHookConfigs(settings({ hooks: { A: [group(`"${gone}" --arg`)] } }));
      expect(headMissing.severity).toBe("issue");
      expect(headMissing.message).toContain(gone);
    });

    it("environment prefixes and node flags are skipped before the script", () => {
      const r = checkHookConfigs(settings({ hooks: { A: [group(`NODE_ENV=production FOO="a b" node --no-warnings "${fwd(join(scripts, "boot.js"))}"`)] } }));
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("1 hook command file(s) checked");
    });

    it("npx tsx <script> stats the script; npx of a package is not a file and is 'not checked'", () => {
      expect(checkHookConfigs(settings({ hooks: { A: [group(`npx tsx "${fwd(join(scripts, "boot.js"))}"`)] } })).severity).toBe("pass");
      const r = checkHookConfigs(settings({ hooks: { A: [group("npx some-package --flag")] } }));
      expect(r.severity).toBe("warn");
      expect(r.message).toContain("npx some-package --flag (npx runs a package, not a file)");
    });

    it("an unparseable command is 'not checked: <command>', never a pass", () => {
      const cases: Array<[string, string]> = [
        [`node "${fwd(join(scripts, "boot.js"))}`, "unterminated quote"],
        ["node", "no script argument after node"],
        ["node ./relative.js", "relative path"],
        ["node $HOME/x.js", "variable"],
        ["FOO=1", "no command after environment prefixes"],
      ];
      for (const [cmd, reason] of cases) {
        const r = checkHookConfigs(settings({ hooks: { A: [group(cmd), group(`node "${fwd(join(scripts, "boot.js"))}"`)] } }));
        expect(r.severity, `${cmd}: ${r.message}`).toBe("warn");
        expect(r.severity).not.toBe("pass");
        expect(r.message).toContain(`not checked: 1 hook command(s) could not be parsed`);
        expect(r.message).toContain(cmd);
        expect(r.message).toContain(reason);
        expect(r.message).toContain("1 hook command file(s) checked");
      }
    });

    it("a bare non-launching command (echo) is skipped and counted, and the legacy flat shape is still read", () => {
      const p = settings({
        hooks: {
          A: [{ command: `node ${fwd(join(scripts, "boot.js"))}` }, "a string, not an object", { type: "x" }, { command: "echo hi" }, group("echo nested")],
        },
      });
      const r = checkHookConfigs(p);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("1 hook command file(s) checked; skipped 4");
      expect(r.message).toContain("1 not an object");
      expect(r.message).toContain("1 with no command string");
      expect(r.message).toContain("2 not a command that launches a file");
      expect(r.message).toContain("of 5 entries");
    });

    it("nothing readable at all is 'not checked', not a pass", () => {
      const r = checkHookConfigs(settings({ hooks: { A: [group("echo only")] } }));
      expect(r.severity).toBe("skip");
      expect(r.message).toContain("not checked: no hook command file was read");
    });
  });

  describe("hook-registration", () => {
    it("counts the registrations it compared and the entries it could not, by reason", () => {
      const p = settings({
        hooks: {
          SessionStart: [{ hooks: [{ command: "node /x/cli-bootstrap.js" }, { type: "command" }, { command: "echo no script here" }] }],
          SessionEnd: [{ hooks: [{ command: "node /x/cli-session-end.js" }] }],
        },
      });
      const r = checkHookRegistration(p);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("2 script registration(s) counted across 2 event(s); skipped 2");
      expect(r.message).toContain("1 with no command");
      expect(r.message).toContain("1 with no recognisable script filename");
    });

    it("zero registrations counted is 'not checked', not 'no duplicates'", () => {
      const p = settings({ hooks: { SessionStart: [{ hooks: [{ command: "echo nothing to see" }] }] } });
      const r = checkHookRegistration(p);
      expect(r.severity).toBe("skip");
      expect(r.message).toContain("not checked");
      expect(r.message).toContain("0 script registration(s) counted across 1 event(s); skipped 1");
    });

    it("a duplicate is still an issue, with the counts", () => {
      const p = settings({ hooks: { SessionStart: [{ hooks: [{ command: "node /x/a.js" }] }, { hooks: [{ command: "node /x/a.js" }] }] } });
      const r = checkHookRegistration(p);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain("a.js registered 2x");
      expect(r.message).toContain("2 script registration(s) counted");
    });
  });

  // B2 ruling (QA 256 row 5, #306): an input that was not examined caps the result at WARN.
  describe("B2 row 5: unreadable and unparseable inputs", () => {
    it("hook-configs: an unparseable settings.json is an ISSUE, and does not throw", () => {
      const p = join(dir, "settings.json");
      writeFileSync(p, "{ not json", "utf-8");
      let r;
      expect(() => { r = checkHookConfigs(p); }).not.toThrow();
      expect(r!.severity).toBe("issue");
      expect(r!.message).toBe("settings.json is not valid JSON");
    });

    function vaultFixture(): { root: string; home: string } {
      const root = join(dir, "proj");
      const home = join(dir, "home");
      mkdirSync(join(root, ".claude", "commands"), { recursive: true });
      mkdirSync(home, { recursive: true });
      writeFileSync(join(root, ".claude", "commands", "clean.md"), "nothing about a vault here\n");
      return { root, home };
    }

    it("vault-path-refs: one clean file beside an UNREADABLE named file is WARN, not pass", () => {
      const { root, home } = vaultFixture();
      mkdirSync(join(root, "CLAUDE.md")); // a directory where a file is named: EISDIR
      const r = checkVaultPathRefs(root, home);
      expect(r.severity, r.message).toBe("warn");
      expect(r.message).toContain("1 .md file(s) scanned");
      expect(r.message).toContain("1 unreadable");
      expect(r.message).toContain("not a full pass");
    });

    it("vault-path-refs: the same clean file with nothing unreadable is still a pass", () => {
      const { root, home } = vaultFixture();
      const r = checkVaultPathRefs(root, home);
      expect(r.severity, r.message).toBe("pass");
    });

    it("vault-path-refs: only an unreadable file is still SKIP, not a pass", () => {
      const { root, home } = vaultFixture();
      mkdirSync(join(root, "CLAUDE.md"));
      rmSync(join(root, ".claude", "commands", "clean.md"));
      expect(checkVaultPathRefs(root, home).severity).toBe("skip");
    });
  });
});
