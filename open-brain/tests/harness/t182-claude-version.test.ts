/**
 * T-182 — a declared minimum Claude Code version, refused at preflight.
 *
 * The claude adapter passes flags an older Claude Code lacks. Before this, an
 * old CLI was found LATE: the base was tagged, the planner stage ran, the
 * developer was retried and the loop ended `schema-cap-exhausted`, with the
 * cause only in a stderr tail. Now `ProcessRole.preflight()` reads
 * `claude --version` and the loop is refused before any tag, naming both
 * versions.
 *
 * Namespace imports on purpose: a missing export fails its row rather than
 * the file.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as roles from "../../src/harness/roles.js";
import * as runtime from "../../src/harness/runtime.js";
import { makeRepo, exitingChecks, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const FIXTURE = join(__dirname, "fixtures", "claude-help-2.1.296.txt");
const help = (): string => readFileSync(FIXTURE, "utf-8");

/** The fixture with every option line naming `flag` removed. */
const withoutOption = (text: string, flag: string): string =>
  text
    .split(/\r?\n/)
    .filter((l) => !(/^ {2}-/.test(l) && l.trimStart().split(/\s{2,}| </)[0]!.split(", ").includes(flag)))
    .join("\n");

describe("T-182 — the installed Claude Code version and flags", () => {
  it("V1: parseClaudeVersion reads the first line, and only an x.y.z version", () => {
    expect(roles.parseClaudeVersion("2.1.296 (Claude Code)\n")).toBe("2.1.296");
    expect(roles.parseClaudeVersion("2.1.282 (Claude Code)\r\n")).toBe("2.1.282");
    expect(roles.parseClaudeVersion("2.1.296")).toBe("2.1.296");
    expect(roles.parseClaudeVersion("")).toBeNull();
    expect(roles.parseClaudeVersion("error: unknown option '--version'")).toBeNull();
    expect(roles.parseClaudeVersion("2.1 (Claude Code)")).toBeNull();
    expect(roles.parseClaudeVersion("claude 2.1.296")).toBeNull();
  });

  it("V2: claudeVersionAtLeast compares numerically, part by part", () => {
    expect(roles.claudeVersionAtLeast("2.1.282", "2.1.282")).toBe(true);
    expect(roles.claudeVersionAtLeast("2.1.296", "2.1.282")).toBe(true);
    expect(roles.claudeVersionAtLeast("2.10.0", "2.9.0")).toBe(true);
    expect(roles.claudeVersionAtLeast("2.1.3", "2.1.282")).toBe(false);
    expect(roles.claudeVersionAtLeast("2.1.281", "2.1.282")).toBe(false);
    expect(roles.claudeVersionAtLeast("1.99.999", "2.1.282")).toBe(false);
  });

  it("F1: missingClaudeFlags reads option lines only, and reports every missing flag in list order", () => {
    const text = help();
    expect(roles.missingClaudeFlags(text)).toEqual([]);
    // Only in a description on this CLI: not an option.
    expect(roles.missingClaudeFlags(text, ["--permission-prompt-tool"])).toEqual(["--permission-prompt-tool"]);
    // Still named in `--restricted`'s description once its own line is gone.
    const noStrict = withoutOption(text, "--strict-mcp-config");
    expect(noStrict).toContain("--strict-mcp-config");
    expect(roles.missingClaudeFlags(noStrict)).toEqual(["--strict-mcp-config"]);
    const noTwo = withoutOption(withoutOption(text, "--effort"), "--permission-prompts");
    expect(roles.missingClaudeFlags(noTwo)).toEqual(["--permission-prompts", "--effort"]);
  });

  it("M1: claudeFlagReport names both versions and every missing flag", () => {
    expect(roles.claudeFlagReport("2.1.250", ["--permission-prompts", "--effort"], "2.1.250 (Claude Code)\n")).toBe(
      "installed 2.1.250, required >= 2.1.282, missing flag(s): --permission-prompts, --effort",
    );
    expect(roles.claudeFlagReport("2.1.296", [], "2.1.296 (Claude Code)\n")).toBe(
      "installed 2.1.296, required >= 2.1.282, missing flag(s): none",
    );
    expect(roles.claudeFlagReport(null, [], "error: unknown option '--version'\nmore\n")).toBe(
      `installed unreadable (claude --version printed "error: unknown option '--version'"), required >= 2.1.282, missing flag(s): none`,
    );
  });

  it("P1: the declared minimum is 2.1.282, and it parses as a version", () => {
    expect(roles.MIN_CLAUDE_CODE_VERSION).toBe("2.1.282");
    expect(roles.parseClaudeVersion(roles.MIN_CLAUDE_CODE_VERSION + " (Claude Code)")).toBe(roles.MIN_CLAUDE_CODE_VERSION);
  });
});

describe("T-182 R1 — an old Claude Code is refused before any tag, commit or artefact", { timeout: 180_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("harness-t182-");
    tmp = scratch("harness-t182-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  /** A fake `claude` that prints `version` and logs its argv, one JSON line per run. */
  const fakeClaude = (version: string): { launcher: string; marker: string } => {
    const launcher = join(tmp.dir, `claude-${version}.cjs`);
    const marker = join(tmp.dir, `argv-${version}.txt`);
    writeFileSync(
      launcher,
      `require("fs").appendFileSync(${JSON.stringify(marker)}, JSON.stringify(process.argv.slice(2)) + "\\n");\n` +
        `process.stdout.write(${JSON.stringify(`${version} (Claude Code)\n`)});\n`,
    );
    return { launcher: realpathSync(launcher), marker };
  };

  const developerFor = (launcher: string) =>
    new roles.ProcessRole("developer", { adapter: roles.claudeAdapter({ launcher }), timeoutMs: 60_000 });

  const loopWith = (developer: roles.ProcessRole): runtime.LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new roles.StubPlanner(), developer, qa: new roles.StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
  });

  const refusedCleanly = (cfg: runtime.LoopConfig, code: string): runtime.LoopRefused => {
    const head = repo.sha();
    let thrown: unknown = null;
    try {
      void runtime.runLoop(cfg);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(runtime.LoopRefused);
    expect((thrown as runtime.LoopRefused).code).toBe(code);
    expect(rawGit(repo.root, ["tag", "--list", "loop-*"])).toBe("");
    expect(repo.sha()).toBe(head);
    expect(existsSync(join(repo.root, "artifacts"))).toBe(false);
    return thrown as runtime.LoopRefused;
  };

  it("2.1.250 is refused with role-version-unsupported, naming both versions; only --version was run", () => {
    const { launcher, marker } = fakeClaude("2.1.250");
    const e = refusedCleanly(loopWith(developerFor(launcher)), "role-version-unsupported");
    expect(e.message).toBe(
      `refusing to start loop t001: the developer role cannot be launched — Claude Code 2.1.250 is installed at ` +
        `${launcher}; the claude adapter requires >= 2.1.282. Refused before any tag, commit or artefact.`,
    );
    expect(readFileSync(marker, "utf-8").trim().split("\n")).toEqual([JSON.stringify(["--version"])]);
  });

  it("CONTROL: 2.1.282 passes preflight", () => {
    const { launcher } = fakeClaude("2.1.282");
    const p = developerFor(launcher).preflight();
    expect(p.ok, p.ok ? "" : p.reason).toBe(true);
  });
});
