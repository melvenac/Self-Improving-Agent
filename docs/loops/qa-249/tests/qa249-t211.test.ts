// QA 249's own probes for T-211 (row 5). Not for merge.
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readStandingCron } from "../../src/pipelines/session-start/agent-identity.js";

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
function seat(files: Record<string, string[]>): string {
  const root = mkdtempSync(join(tmpdir(), "qa249-t211-"));
  roots.push(root);
  mkdirSync(join(root, ".agents"), { recursive: true });
  for (const [f, lines] of Object.entries(files)) writeFileSync(join(root, ".agents", f), `---\n${lines.join("\n")}\n---\n\n# body\n`);
  return root;
}
const ID = ["name: Atlas", "role: planner", "partner: Forge"];
const FULL = ['status_cron: "7,37 * * * *"', "status_to: clark", "status_rule: docs/rule.md"];

describe("QA 249 row 5 probes", () => {
  it("(a) a local file with only status_to shadows AGENT.md (first file with ANY key wins)", () => {
    const root = seat({ "AGENT.md": [...ID, ...FULL], "AGENT.local.md": [...ID, "status_to: atlas-sia"] });
    expect(readStandingCron(root)).toBe("Standing cron: INVALID in .agents/AGENT.local.md: status_cron is missing");
  });
  it("(b) minute 60 is out of range", () => {
    const root = seat({ "AGENT.local.md": [...ID, 'status_cron: "60 * * * *"', "status_to: clark", "status_rule: r.md"] });
    expect(readStandingCron(root)).toBe('Standing cron: INVALID in .agents/AGENT.local.md: status_cron minute field "60" is out of range 0-59');
  });
  it("probe: minute 59 is in range (boundary)", () => {
    const root = seat({ "AGENT.local.md": [...ID, 'status_cron: "59 * * * *"', "status_to: clark", "status_rule: r.md"] });
    expect(readStandingCron(root)).toContain("Standing cron: 59 * * * * → status to clark");
  });
  it("probe: the template's documented example, copied verbatim with its trailing comment", () => {
    const root = seat({ "AGENT.local.md": [...ID, 'status_cron: "*/20 * * * *"        # a 5-field cron, local time', "status_to: clark", "status_rule: r.md"] });
    console.log("QA249-TEMPLATE-COPY: " + readStandingCron(root));
  });
});
