/** T-257: the suite drops the host harness's CLAUDE_* / CURSOR_* env (a CC run matches CI) */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { HOST_ENV_PATTERN, scrubHostEnv } from "./harness/host-env.js";

describe("T-257 host env scrub", () => {
  it("HE-1: scrubHostEnv removes every host variable and returns their names", () => {
    const env: NodeJS.ProcessEnv = {
      CLAUDE_PID: "1",
      CLAUDE_CODE_SESSION_ID: "s",
      CLAUDECODE: "1",
      CURSOR_COMMAND_SET: "x",
      PATH: "p",
      HOME: "h",
    };
    expect(scrubHostEnv(env)).toEqual([
      "CLAUDECODE",
      "CLAUDE_CODE_SESSION_ID",
      "CLAUDE_PID",
      "CURSOR_COMMAND_SET",
    ]);
    expect(Object.keys(env).sort()).toEqual(["HOME", "PATH"]);
  });

  it("HE-2: lookalikes stay", () => {
    const env: NodeJS.ProcessEnv = { CLAUDEX: "1", MY_CLAUDE_PID: "1", CURSORX: "1" };
    expect(scrubHostEnv(env)).toEqual([]);
    expect(Object.keys(env).sort()).toEqual(["CLAUDEX", "CURSORX", "MY_CLAUDE_PID"]);
  });

  it("HE-3: the test process carries no host variable", () => {
    expect(Object.keys(process.env).filter((k) => HOST_ENV_PATTERN.test(k))).toEqual([]);
  });

  it("HE-4: a spawned child carries none either", () => {
    const r = spawnSync(
      process.execPath,
      [
        "-e",
        "console.log(Object.keys(process.env).filter(k=>/^(CLAUDE_|CLAUDECODE$|CURSOR_)/.test(k)).join(','))",
      ],
      { env: process.env, encoding: "utf8" },
    );
    expect(r.stdout.trim()).toBe("");
  });
});
