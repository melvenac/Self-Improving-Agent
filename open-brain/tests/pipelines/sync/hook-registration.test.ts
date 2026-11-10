import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkHookRegistration } from "../../../src/pipelines/sync/checks.js";

describe("checkHookRegistration", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ob-hookreg-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  const settings = (obj: unknown) => {
    const p = join(dir, "settings.json");
    writeFileSync(p, JSON.stringify(obj), "utf-8");
    return p;
  };

  it("passes when each hook script is registered once per event", () => {
    const p = settings({
      hooks: {
        SessionStart: [{ hooks: [{ command: "node /x/cli-bootstrap.js" }] }],
        SessionEnd: [{ hooks: [{ command: "node /x/cli-session-end.js" }] }],
      },
    });
    expect(checkHookRegistration(p).severity).toBe("pass");
  });

  it("flags the same script registered twice for one event", () => {
    const p = settings({
      hooks: {
        SessionStart: [
          { hooks: [{ command: "node /x/cli-bootstrap.js" }] },
          { hooks: [{ command: "node /x/cli-bootstrap.js" }] },
        ],
      },
    });
    const r = checkHookRegistration(p);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("cli-bootstrap.js registered 2x");
  });

  it("collapses path spelling differences to the same registration", () => {
    // Backslashes vs forward slashes, drive-letter case — still one script.
    const p = settings({
      hooks: {
        SessionStart: [
          { hooks: [{ command: 'node "C:\\Users\\a\\build\\cli-bootstrap.js"' }] },
          { hooks: [{ command: "node c:/users/a/build/cli-bootstrap.js" }] },
        ],
      },
    });
    expect(checkHookRegistration(p).severity).toBe("issue");
  });

  it("allows the same script on two different events", () => {
    const p = settings({
      hooks: {
        SessionStart: [{ hooks: [{ command: "node /x/shared.js" }] }],
        SessionEnd: [{ hooks: [{ command: "node /x/shared.js" }] }],
      },
    });
    expect(checkHookRegistration(p).severity).toBe("pass");
  });

  it("T341-1: one script on disjoint matchers (the recall trigger's live shape) is not a duplicate", () => {
    const p = settings({
      hooks: {
        PostToolUse: [
          { matcher: "Bash|PowerShell", hooks: [{ command: "node /x/cli-recall-trigger.js" }] },
          { matcher: "Edit|Write", hooks: [{ command: "node /x/cli-recall-trigger.js" }] },
        ],
      },
    });
    const r = checkHookRegistration(p);
    expect(r.severity, r.message).toBe("pass");
  });

  it("T341-2: overlapping matchers are a duplicate", () => {
    const p = settings({
      hooks: {
        PostToolUse: [
          { matcher: "Bash", hooks: [{ command: "node /x/cli-recall-trigger.js" }] },
          { matcher: "Bash|PowerShell", hooks: [{ command: "node /x/cli-recall-trigger.js" }] },
        ],
      },
    });
    const r = checkHookRegistration(p);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("PostToolUse: cli-recall-trigger.js registered 2x");
  });

  it("T341-3: a '*' matcher overlaps every tool", () => {
    const p = settings({
      hooks: {
        PostToolUse: [
          { matcher: "*", hooks: [{ command: "node /x/a.js" }] },
          { matcher: "Edit", hooks: [{ command: "node /x/a.js" }] },
        ],
      },
    });
    expect(checkHookRegistration(p).severity).toBe("issue");
  });

  it("T341-4: of three registrations, only the two that overlap are counted", () => {
    const p = settings({
      hooks: {
        PostToolUse: [
          { matcher: "Bash", hooks: [{ command: "node /x/a.js" }] },
          { matcher: "Bash|PowerShell", hooks: [{ command: "node /x/a.js" }] },
          { matcher: "Edit|Write", hooks: [{ command: "node /x/a.js" }] },
        ],
      },
    });
    const r = checkHookRegistration(p);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("a.js registered 2x");
  });

  it("reports invalid JSON rather than throwing", () => {
    const p = join(dir, "settings.json");
    writeFileSync(p, "{not json", "utf-8");
    expect(checkHookRegistration(p).severity).toBe("issue");
  });

  it("warns when settings.json is missing", () => {
    expect(checkHookRegistration(join(dir, "nope.json")).severity).toBe("warn");
  });

  it("is 'not checked', not a pass, with no hooks block (T-048: zero counted is not 'no duplicates')", () => {
    const r = checkHookRegistration(settings({}));
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("not checked");
    expect(r.message).toContain("0 script registration(s) counted");
  });
});
