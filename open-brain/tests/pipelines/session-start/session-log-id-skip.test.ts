/**
 * T-255 SL-6: sessionStart when createSessionLog refuses (mocked).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../../../src/pipelines/session-start/session-log.js", async (orig) => ({
  ...(await orig<typeof import("../../../src/pipelines/session-start/session-log.js")>()),
  claimSessionLog: () => null,
}));

import { sessionStart } from "../../../src/pipelines/session-start/index.js";

const ID = "c28bf91a-7f93-47c6-a711-0a11bb5b0c2d";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe("T-255 session log skip reason", () => {
  it("SL-6: claimSessionLog returning null sets skippedReason for probe exhaustion", () => {
    const root = mkdtempSync(join(tmpdir(), "t255-"));
    const home = mkdtempSync(join(tmpdir(), "t255-home-"));
    tmps.push(root, home);
    mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
    const result = sessionStart({ projectRoot: root, homePath: home, sessionId: ID });
    expect(result.session.logPath).toBe("");
    expect(result.session.reused).toBe(false);
    expect(result.session.skippedReason).toBe(
      "Session_1.md through Session_20.md all already exist (not matched to this session's id) — none was overwritten, and no log was created for this session",
    );
  });
});
