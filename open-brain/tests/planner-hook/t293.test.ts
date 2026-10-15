import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPlannerHook } from "../../src/planner-hook/run.js";

// T-293: `bash <file.sh> [args]` runs as `node <file.js> [args]` does, and records/ is a standing push branch.
// S is the literal text the planner types; it is only text, and nothing opens it.
const S = "C:/Users/melve/.claude/skills/atlas-ops/scripts";

let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "planner-hook-t293-"));
  mkdirSync(join(repo, ".agents"), { recursive: true });
  writeFileSync(
    join(repo, ".agents", "AGENT.local.md"),
    `---\nname: Atlas\nrole: planner\npartner: Forge\n---\n`,
    "utf-8",
  );
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

function decide(command: string) {
  return runPlannerHook(
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: repo },
    { summaryContent: null },
  ).decision;
}

const ALLOW: Array<[string, string]> = [
  ["A1", `bash ${S}/records-pr.sh records/rev467-s171 msg.txt`],
  ["A2", `bash ${S}/tree-sync.sh`],
  ["A3", "bash scripts/run-me.sh --flag value"],
  ["A4", "git push origin records/rev467-s171"],
  ["A5", "git push origin records/rev467-s171:records/rev467-s171"],
];

const DENY: Array<[string, string]> = [
  ["D1", "bash -x scripts/run-me.sh"],
  ["D2", "bash scripts/run-me.py"],
  ["D3", "bash"],
  ["D4", "sh scripts/run-me.sh"],
  ["D5", "git push origin records/x:master"],
  ["D6", "git push --force origin records/rev467-s171"],
  ["D7", "git push origin records/"],
  ["D8", "bash -c 'git merge origin/master'"],
  ["D9", "bash $S/records-pr.sh records/x m.txt"],
  ["D10", "bash --rcfile=x.sh"],
];

describe("T-293: bash <file.sh> and records/ pushes", () => {
  it.each(ALLOW)("%s allows: %s", (_id, command) => {
    expect(decide(command)).not.toBe("deny");
  });

  it.each(DENY)("%s denies: %s", (_id, command) => {
    expect(decide(command)).toBe("deny");
  });
});
