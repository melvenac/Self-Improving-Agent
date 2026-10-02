// QA 251 row 5 (F4) probe. Not for merge. Reads the template's documented example from the template file at run
// time, puts it into a seat file's frontmatter byte for byte (placeholders and all), and runs the start-time reader.
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readStandingCron } from "../../src/pipelines/session-start/agent-identity.js";

const TEMPLATE = join(import.meta.dirname, "../../../project-template/.agents/AGENT.md");
const SCRATCH = "/home/agents/qa-tmp";

describe("QA 251 F4: the template's documented example through readStandingCron", () => {
  it("verbatim example, no placeholder filled", () => {
    const template = readFileSync(TEMPLATE, "utf-8");
    const block = template.match(/```\n(status_cron:[\s\S]*?)```/);
    expect(block).not.toBeNull();
    const text = block![1]!;
    console.log("QA251-F4-EXAMPLE-JSON: " + JSON.stringify(text));
    const root = mkdtempSync(join(SCRATCH, "qa251-f4-"));
    try {
      mkdirSync(join(root, ".agents"), { recursive: true });
      writeFileSync(join(root, ".agents", "AGENT.local.md"), `---\nname: Atlas\nrole: planner\n${text}---\n\n# body\n`, "utf-8");
      const out = readStandingCron(root);
      console.log("QA251-F4-READER: " + out);
      expect(out).not.toContain("INVALID");
      expect(out).toBe(
        "Standing cron: */20 * * * * → status to <agent-name> (rule: .agents/roles/<role>.md). Create it with CronCreate before the briefing ends.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("example with only the two <placeholders> filled, every other byte from the file", () => {
    const template = readFileSync(TEMPLATE, "utf-8");
    // Round 1 kept a trailing comment inside the fence, so take the whole fenced block that holds the keys.
    const block = template.match(/```[^\n]*\n((?:[^\n]*\n)*?status_cron:[\s\S]*?)```/);
    expect(block).not.toBeNull();
    const text = block![1]!.replace("<agent-name>", "clark").replace("<role>", "planner");
    console.log("QA251-F4-FILLED-JSON: " + JSON.stringify(text));
    const root = mkdtempSync(join(SCRATCH, "qa251-f4-"));
    try {
      mkdirSync(join(root, ".agents"), { recursive: true });
      writeFileSync(join(root, ".agents", "AGENT.local.md"), `---\nname: Atlas\nrole: planner\n${text}---\n\n# body\n`, "utf-8");
      const out = readStandingCron(root);
      console.log("QA251-F4-FILLED-READER: " + out);
      expect(out).toBe(
        "Standing cron: */20 * * * * → status to clark (rule: .agents/roles/planner.md). Create it with CronCreate before the briefing ends.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("the template file itself as a seat's AGENT.md (example is in the body, not frontmatter)", () => {
    const out = readStandingCron(join(import.meta.dirname, "../../../project-template"));
    console.log("QA251-F4-TEMPLATE-AS-SEAT: " + out);
    expect(out).toBe("Standing cron: none in seat data.");
  });
});
