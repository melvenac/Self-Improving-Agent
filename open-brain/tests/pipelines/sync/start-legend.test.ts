import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderInbox } from "../../../src/pipelines/state-views/index.js";
import { readRepoRecord } from "../../helpers/repo-record.js";

/**
 * T-148: the titles-only legend said to read a task's note "when you work the task, not when you pick one". Ruling on a
 * task is neither picking nor working, and retiring one is neither either: T-050 was classified from its title as being
 * about a writer when its note says it is about an uncounted read. The sentence now covers ruling on and retiring.
 */
const SENTENCE_START = "read it before you rule on, work or retire a task, not when you merely pick one";
const repo = join(process.cwd(), "..");
const copies = [".claude/commands/start.md", "project-template/.claude/commands/start.md", "project-template/.cursor/commands/start.md"];
const text = (rel: string): string => readFileSync(join(repo, rel), "utf-8").replace(/\r\n/g, "\n");

describe("T-148 the titles-only legend covers ruling on and retiring a task", () => {
  it("the INBOX.md legend (state-views) carries the sentence and no longer limits the note to working a task", () => {
    const { state } = readRepoRecord();
    const inbox = renderInbox(state, { version: "0.0.0", session: 1 });
    expect(inbox).toContain(`its \`note\` in \`.agents/state.json\` under \`tasks[]\` — ${SENTENCE_START}.`);
    expect(inbox).not.toContain("read it when you work the task, not when you pick one");
  });

  for (const rel of copies) {
    it(`${rel}: says to read the note before ruling on or retiring a task`, () => {
      const t = text(rel);
      expect(t).toContain(`A task's rationale is its \`note\` in\n\`.agents/state.json\` under \`tasks[]\`. Read that before you rule on, work or retire a task, not when you merely pick one.`);
      expect(t).not.toContain("Read that when you work a task, not when you pick one.");
    });
  }
});
