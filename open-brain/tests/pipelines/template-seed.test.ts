import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseState } from "../../src/shared/state-schema.js";
import { handleStart } from "../../src/server.js";

const templateDir = join(import.meta.dirname, "../../../project-template");
const seedPath = join(templateDir, ".agents", "state.json");

function getText(response: { content: { type: string; text: string }[] }): string {
  return response.content.map((c) => c.text).join("\n");
}

/** Loop 4 C5 / V8: the template ships a revision-0 state.json that a scaffolded project can start from. */
describe("project-template/.agents/state.json seed", () => {
  const tmps: string[] = [];
  afterEach(() => { for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

  it("exists, validates against StateSchema, and is the empty revision-0 shape", () => {
    expect(existsSync(seedPath)).toBe(true);
    const r = parseState(readFileSync(seedPath, "utf-8"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      schema_version: 1,
      revision: 0,
      project: { name: "{{PROJECT}}" },
      objective: null,
      tasks: [],
      verified: [],
      gaps: [],
      decisions: [],
      handoff: { pick_up: "", watch_out: [], open_questions: [], session: 0 },
      last_session: { n: 0, uuid: null },
    });
    expect(r.data.last_session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("/start on a scaffolded temp project renders `State (state.json rev 0)` (V8)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ob-template-seed-"));
    tmps.push(tmp);
    cpSync(join(templateDir, ".agents"), join(tmp, ".agents"), { recursive: true });
    // Loop 8 R3: the seed no longer carries a version. package.json is the only
    // authority for it, and /start renders it from there.
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "scaffolded", version: "0.0.0" }));
    const res = await handleStart({ project_root: tmp });
    const text = getText(res);
    expect(text).toContain("## State (state.json rev 0)");
    expect(text).toContain("Project: {{PROJECT}} v0.0.0");
    expect(text).toContain("Objective: none");
    expect(text).not.toContain("state.json invalid");
  });

  it("the template's gitignore (shipped without the dot) tracks exactly the five state files", () => {
    const text = readFileSync(join(templateDir, "gitignore"), "utf-8");
    const rules = text.split(/\r?\n/).filter((l) => l.startsWith("/.agents") || l.startsWith("!/.agents"));
    expect(rules).toEqual([
      "/.agents/*",
      "!/.agents/state.json",
      "!/.agents/TASKS/",
      "/.agents/TASKS/*",
      "!/.agents/TASKS/INBOX.md",
      "!/.agents/TASKS/task.md",
      "!/.agents/SESSIONS/",
      "/.agents/SESSIONS/*",
      "!/.agents/SESSIONS/next-session.md",
      "!/.agents/SYSTEM/",
      "/.agents/SYSTEM/*",
      "!/.agents/SYSTEM/SUMMARY.md",
    ]);
    // The repo root carries the same block (C4, both places).
    const rootLines = readFileSync(join(templateDir, "..", ".gitignore"), "utf-8").split(/\r?\n/);
    for (const r of rules) expect(rootLines).toContain(r);
  });
});
