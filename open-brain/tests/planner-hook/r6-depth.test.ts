/**
 * T-194 r6: defence in depth. The P0 parse gate refuses a command before P1-P3 ever read it, so a test that goes through the
 * hook can no longer reach the code r5 wrote for `$( )`, heredocs, substituted words and `Invoke-Expression`. That code is
 * kept (r5's 50 mutants must stay red, and `sh -c '<string>'` is still parseable and still nested), and these rows call the P1,
 * P2 and P2b functions DIRECTLY, with commands the gate would refuse, so removing any of it is still seen.
 */
import { describe, it, expect } from "vitest";
import { detectBashWriteTargets } from "../../src/planner-hook/bash.js";
import { analyzeGhMerge, isGitRestricted } from "../../src/planner-hook/git.js";

const ROOT = "/tmp/r6-depth-root";

describe("P1 without the gate (bash.ts)", () => {
  it("a heredoc body is data, not commands", () => {
    expect(detectBashWriteTargets("cat <<'EOF' > docs/loops/q.md\n> quoted **bold** $VAR\nEOF", ROOT)).toEqual([]);
    expect(detectBashWriteTargets("cat <<'EOF' > open-brain/src/x.ts\nbody\nEOF", ROOT)).not.toEqual([]);
  });

  it("a write inside $( ) and backticks and eval is found", () => {
    expect(detectBashWriteTargets('echo "$(echo x > open-brain/src/x.ts)"', ROOT)).not.toEqual([]);
    expect(detectBashWriteTargets("eval 'echo x > open-brain/src/x.ts'", ROOT)).not.toEqual([]);
  });

  it("PowerShell: Invoke-Expression, iex and a script block that writes are refused as undeterminable", () => {
    for (const c of ["Invoke-Expression 'Set-Content x y'", "iex $c", "icm { Set-Content x y }", "1 | ForEach-Object { Set-Content $_ x }"]) {
      expect(detectBashWriteTargets(c, ROOT, ROOT, "powershell"), c).not.toEqual([]);
    }
  });
});

describe("P2 without the gate (git.ts analyzeGhMerge)", () => {
  it("a substituted command word could be gh", () => {
    expect(analyzeGhMerge("$GH pr merge 1").isMerge).toBe(true);
    expect(analyzeGhMerge("echo `gh pr merge 1`").isMerge).toBe(true);
  });

  it("a grouped command is not the one exact grammar", () => {
    const a = analyzeGhMerge("(gh pr merge 1)");
    expect(a.isMerge).toBe(true);
    expect(a.single).toBe(false);
    expect(a.exact).toBeNull();
    expect(analyzeGhMerge("gh pr merge 1 && echo x").exact).toBeNull();
    expect(analyzeGhMerge("gh pr merge 1").exact).toEqual({ ref: "1" });
  });
});

describe("P2b without the gate (git.ts isGitRestricted)", () => {
  it("a substituted git word, subcommand or push argument is restricted", () => {
    expect(isGitRestricted("$GIT push origin master")).toBe(true);
    expect(isGitRestricted("git $SUB origin loop/x")).toBe(true);
    expect(isGitRestricted("git push origin loop/$BR")).toBe(true);
    expect(isGitRestricted('git push origin "loop/$BR"')).toBe(true);
    expect(isGitRestricted("git push $REMOTE loop/x")).toBe(true);
  });

  it("the same push with literal words is standing", () => {
    expect(isGitRestricted("git push origin loop/x")).toBe(false);
  });
});
