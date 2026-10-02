import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkHookConfigs, checkHookRegistration } from "../../../src/pipelines/sync/checks.js";

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
    it("the real settings.json shape (matcher groups holding hooks[]) reads ZERO entries and says so, instead of 'All hook command files exist'", () => {
      const p = settings({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node /x/cli-bootstrap.js" }] }], SessionEnd: [{ hooks: [{ command: "node /x/end.js" }] }] } });
      const r = checkHookConfigs(p);
      expect(r.severity).toBe("skip");
      expect(r.message).toContain("not checked");
      expect(r.message).toContain("0 hook command file(s) checked; skipped 2 (2 with no command string) of 2 entries");
      expect(r.message).toContain("not a pass");
    });

    it("a pass states how many it checked and how many it skipped, by reason", () => {
      const real = join(dir, "present.mjs");
      writeFileSync(real, "");
      const p = settings({
        hooks: {
          A: [{ command: `node ${real}` }, "a string, not an object", { type: "x" }, { command: "echo hi" }, { command: "node " }],
        },
      });
      const r = checkHookConfigs(p);
      expect(r.severity, r.message).toBe("pass");
      expect(r.message).toContain("1 hook command file(s) checked; skipped 4");
      expect(r.message).toContain("1 not an object");
      expect(r.message).toContain("1 with no command string");
      expect(r.message).toContain("1 not a node/npx tsx command");
      expect(r.message).toContain("1 with no file path after node/npx tsx");
      expect(r.message).toContain("of 5 entries");
    });

    it("a missing file is still an issue, and the counts ride along", () => {
      const p = settings({ hooks: { A: [{ command: "node /nonexistent/a.mjs" }, { command: "echo hi" }] } });
      const r = checkHookConfigs(p);
      expect(r.severity).toBe("issue");
      expect(r.message).toContain("/nonexistent/a.mjs");
      expect(r.message).toContain("1 hook command file(s) checked; skipped 1");
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
});

void mkdirSync;
