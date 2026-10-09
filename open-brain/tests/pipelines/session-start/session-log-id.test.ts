/**
 * T-255: session id always stamped; never overwrite existing log (SL-1..SL-5).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  cpSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  claimSessionLog,
  createSessionLog,
  findExistingSessionLog,
  nextGreetingSessionNumber,
} from "../../../src/pipelines/session-start/session-log.js";
import { readProjectState } from "../../../src/pipelines/session-start/state-reader.js";
import { sessionStart } from "../../../src/pipelines/session-start/index.js";
import { fileURLToPath } from "node:url";

const ID = "c28bf91a-7f93-47c6-a711-0a11bb5b0c2d";
const MAKER_TEMPLATE = [
  "# Session Log: Session_N (YYYY-MM-DD)",
  "<!-- NAMING: Use Session_11.md, Session_12.md, etc. (sequential, not date-based) -->",
  "",
  "## Session Objective",
].join("\r\n") + "\r\n";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function projectRoot(): string {
  const d = mkdtempSync(join(tmpdir(), "t255-"));
  tmps.push(d);
  mkdirSync(join(d, ".agents", "SESSIONS"), { recursive: true });
  return d;
}

describe("T-255 session log id", () => {
  it("SL-1: Maker CRLF template gets Session ID on line 2 and findExistingSessionLog finds it", () => {
    const root = projectRoot();
    writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), MAKER_TEMPLATE);
    const logPath = createSessionLog(root, 1, ID, "2026-10-09");
    const lines = readFileSync(logPath, "utf8").split("\n");
    expect(lines[1]).toBe(`> **Session ID:** ${ID}`);
    expect(findExistingSessionLog(root, ID)).toEqual({ sessionNumber: 1, logPath });
  });

  it("SL-2: Status-line template keeps byte-identical id insertion", () => {
    const root = projectRoot();
    const template = "# Session N — [Date]\n\n> **Objective:** x\n> **Status:** In Progress\n";
    writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), template);
    const logPath = createSessionLog(root, 1, ID, "2026-10-09");
    expect(readFileSync(logPath, "utf8")).toBe(
      `# Session 1 — 2026-10-09\n\n> **Objective:** x\n> **Session ID:** ${ID}\n> **Status:** In Progress\n`,
    );
  });

  it("SL-3: built-in fallback template includes Session ID before Status", () => {
    const root = projectRoot();
    const logPath = createSessionLog(root, 1, ID, "2026-10-09");
    expect(readFileSync(logPath, "utf8")).toContain(`> **Session ID:** ${ID}\n> **Status:** In Progress`);
  });

  it("SL-4: second sessionStart with same id reuses one log file", () => {
    const root = projectRoot();
    const home = mkdtempSync(join(tmpdir(), "t255-home-"));
    tmps.push(home);
    writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), MAKER_TEMPLATE);
    const first = sessionStart({ projectRoot: root, homePath: home, sessionId: ID });
    expect(first.session.reused).toBe(false);
    const second = sessionStart({ projectRoot: root, homePath: home, sessionId: ID });
    expect(second.session.reused).toBe(true);
    expect(second.session.logPath).toBe(first.session.logPath);
    expect(second.session.sessionNumber).toBe(first.session.sessionNumber);
    const sessionFiles = readdirSync(join(root, ".agents", "SESSIONS")).filter((f) => /^Session_\d+\.md$/.test(f));
    expect(sessionFiles).toHaveLength(1);
  });

  it("SL-5: existing Session_1.md without id is never overwritten", () => {
    const root = projectRoot();
    const logFile = join(root, ".agents", "SESSIONS", "Session_1.md");
    writeFileSync(logFile, "OLD\n");
    expect(createSessionLog(root, 1, ID, "2026-10-09")).toBe("");
    expect(readFileSync(logFile, "utf8")).toBe("OLD\n");
  });

  it("SL-7: record path bumps when Session_55.md is taken", () => {
    const root = mkdtempSync(join(tmpdir(), "t255-"));
    const home = mkdtempSync(join(tmpdir(), "t255-home-"));
    tmps.push(root, home);
    mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
    cpSync(
      fileURLToPath(new URL("../../fixtures-state/state.json", import.meta.url)),
      join(root, ".agents", "state.json"),
    );
    const state = readProjectState(root);
    expect(nextGreetingSessionNumber(root, state.stateJson)).toEqual({ sessionNumber: 55, source: "record" });
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_55.md"), "OLD\n");
    const first = sessionStart({ projectRoot: root, homePath: home, sessionId: ID });
    expect(first.session.sessionNumber).toBe(56);
    expect(first.session.logPath.endsWith("Session_56.md")).toBe(true);
    expect(first.session.takenNumber).toBe(55);
    expect(first.session.reused).toBe(false);
    expect(readFileSync(join(root, ".agents", "SESSIONS", "Session_55.md"), "utf8")).toBe("OLD\n");
    const second = sessionStart({ projectRoot: root, homePath: home, sessionId: ID });
    expect(second.session.reused).toBe(true);
    expect(second.session.logPath).toBe(first.session.logPath);
    const sessionFiles = readdirSync(join(root, ".agents", "SESSIONS")).filter((f) => /^Session_\d+\.md$/.test(f));
    expect(sessionFiles).toHaveLength(2);
  });

  it("SL-8: claimSessionLog returns null when probe window is full", () => {
    const root = projectRoot();
    for (let n = 1; n <= 20; n++) {
      writeFileSync(join(root, ".agents", "SESSIONS", `Session_${n}.md`), "X\n");
    }
    expect(claimSessionLog(root, 1, ID, "2026-10-09")).toBe(null);
    expect(existsSync(join(root, ".agents", "SESSIONS", "Session_21.md"))).toBe(false);
  });

  it("SL-9: claimSessionLog skips one taken number", () => {
    const root = projectRoot();
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_3.md"), "X\n");
    const expectedPath = join(root, ".agents", "SESSIONS", "Session_4.md");
    expect(claimSessionLog(root, 3, ID, "2026-10-09")).toEqual({ sessionNumber: 4, logPath: expectedPath });
    expect(readFileSync(join(root, ".agents", "SESSIONS", "Session_3.md"), "utf8")).toBe("X\n");
  });
});
