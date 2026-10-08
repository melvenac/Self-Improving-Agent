import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { handleSetSession, handleState, handleStart } from "../../src/server.js";
import { describeRoleFiles } from "../../src/pipelines/session-start/role-files.js";
import { readAgentIdentity } from "../../src/pipelines/session-start/agent-identity.js";

const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");

function proseProject(dir: string): void {
  mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
  writeFileSync(join(dir, ".agents", "AGENT.md"), "---\nname: Builder\nrole: developer\npartner: Atlas\n---\n\n# Seat\n");
  writeFileSync(join(dir, ".agents", "roles", "developer.md"), readFileSync(join(import.meta.dirname, "../../..", ".agents/roles/developer.md"), "utf8"));
  writeFileSync(join(dir, ".agents", "roles", "shared.md"), "# shared\n");
  writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), "# Inbox\n");
  writeFileSync(join(dir, ".agents", "TASKS", "task.md"), "# Task\n");
  writeFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), "# Next\n");
  writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), "# Summary\n<!-- state:begin -->\n<!-- state:end -->\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.45.0" }));
}

function getText(res: { content?: { type: string; text?: string }[]; isError?: boolean }): string {
  return res.content?.map((c) => c.text ?? "").join("\n") ?? "";
}

describe("F4: standing decisions via ob_state and ob_start", () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "fleet-ae-f4-"));
    proseProject(tmp);
    cpSync(stateFixture, join(tmp, ".agents", "state.json"));
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("add_decision {standing:true} and set_standing render under STANDING RULES; untagging removes it", async () => {
    const roles = describeRoleFiles(tmp, readAgentIdentity(tmp));
    const dev = roles.files.find((f) => f.rel.endsWith("developer.md"));
    expect(dev?.rel).toContain("developer.md");

    await handleSetSession({ session_id: "fleet-ae-f4", project_dir: tmp });
    const add = await handleState({
      project_root: tmp,
      session: 99,
      expected_revision: 7,
      ops: [{ op: "add_decision", title: "Always cite SHAs", date: "2026-10-08", note: "test", standing: true }],
    });
    expect(add.isError).toBeUndefined();
    let start = getText(await handleStart({ project_root: tmp }));
    expect(start).toContain("STANDING RULES");
    expect(start).toContain("D-007 — Always cite SHAs");

    const tag = await handleState({
      project_root: tmp,
      session: 99,
      expected_revision: 8,
      ops: [{ op: "set_standing", id: "D-001", standing: true }],
    });
    expect(tag.isError).toBeUndefined();
    start = getText(await handleStart({ project_root: tmp }));
    expect(start).toContain("D-001 —");

    const untag = await handleState({
      project_root: tmp,
      session: 99,
      expected_revision: 9,
      ops: [{ op: "set_standing", id: "D-007", standing: false }],
    });
    expect(untag.isError).toBeUndefined();
    start = getText(await handleStart({ project_root: tmp }));
    expect(start).not.toContain("D-007 — Always cite SHAs");
    expect(start).toContain("D-001 —");
  });
});
