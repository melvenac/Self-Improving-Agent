/**
 * R87. R72's decision at the runLoop call site, not at the helper.
 * An equal-text finding with changed true is reported. A text difference
 * with changed false is not. QA 108's q108-r72-callsite mutant
 * (skip when the texts are equal) turns the first row red and reports the second.
 * No filesystem act produces an equal-text change, so compare() is given one.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MachineConfigWatch, type MachineConfigFinding } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const EQUAL = "r87-equal-text";
const UNCHANGED = "r87-unchanged-text";

describe("R87 call site reports changed, not text inequality", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  let realCompare: MachineConfigWatch["compare"];

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("r87-");
    tmp = scratch("r87-out-");
    realCompare = MachineConfigWatch.prototype.compare;
    MachineConfigWatch.prototype.compare = function compare(): MachineConfigFinding[] {
      return [
        { stage: "developer", scope: "global", path: EQUAL, before: "same-text", after: "same-text", changed: true },
        { stage: "developer", scope: "global", path: UNCHANGED, before: "before-text", after: "after-text", changed: false },
      ];
    };
  });
  afterEach(async () => {
    MachineConfigWatch.prototype.compare = realCompare;
    await repo.cleanup();
    await tmp.cleanup();
  });

  const envFor = (home: string): NodeJS.ProcessEnv => {
    const xdg = join(tmp.dir, "r87-xdg");
    mkdirSync(xdg, { recursive: true });
    const system = join(tmp.dir, "r87-system.gitconfig");
    writeFileSync(system, "");
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: system };
    delete env.GIT_CONFIG_GLOBAL;
    return env;
  };

  const run = async (): Promise<LoopResult> => {
    const home = join(tmp.dir, "r87-home");
    mkdirSync(home);
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      env: envFor(home),
      roles: {
        planner: new StubPlanner(),
        developer: new StubDeveloper(),
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    return runLoop(loop);
  };

  it("R87-EQUAL-REPORTED: equal texts are reported when the comparison says changed", async () => {
    const r = await run();
    const reported = r.findings.filter((line) => line.includes(EQUAL));
    expect(reported.length, "the call site reports a changed finding whose texts are equal").toBeGreaterThan(0);
    expect(reported[0], "the report quotes both texts").toContain("same-text → same-text");
  });

  it("R87-UNCHANGED-SILENT: a text difference is not reported when the comparison says unchanged", async () => {
    const r = await run();
    const reported = r.findings.filter((line) => line.includes(UNCHANGED));
    expect(reported, "the call site does not report an unchanged finding").toEqual([]);
  });
});
