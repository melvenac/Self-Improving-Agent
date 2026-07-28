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

  it("reports invalid JSON rather than throwing", () => {
    const p = join(dir, "settings.json");
    writeFileSync(p, "{not json", "utf-8");
    expect(checkHookRegistration(p).severity).toBe("issue");
  });

  it("warns when settings.json is missing", () => {
    expect(checkHookRegistration(join(dir, "nope.json")).severity).toBe("warn");
  });

  it("handles settings with no hooks block", () => {
    expect(checkHookRegistration(settings({})).severity).toBe("pass");
  });
});
