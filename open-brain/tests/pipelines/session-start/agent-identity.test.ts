import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readAgentIdentity } from "../../../src/pipelines/session-start/agent-identity.js";

/**
 * Seat identity is a property of the CHECKOUT, not of the repo.
 *
 * `.agents/AGENT.md` is tracked, so every worktree shares one declaration. On
 * 2026-09-17 that meant three worktrees and one `name: Forge`, and /start
 * greeted whoever started in any of them as Forge — including the Planner seat,
 * which is Atlas. A tracked file cannot say who is sitting in a particular
 * checkout, because the checkout is not the thing git versions.
 */
describe("readAgentIdentity", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function setup(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "ident-"));
    mkdirSync(join(dir, ".agents"), { recursive: true });
    for (const [rel, body] of Object.entries(files)) {
      writeFileSync(join(dir, ".agents", rel), body, "utf8");
    }
    return dir;
  }

  const FORGE = `---\nname: Forge\nrole: builder\npartner: Atlas\n---\n\n# Forge\n`;
  const ATLAS = `---\nname: Atlas\nrole: planner\npartner: Forge\n---\n\n# Atlas\n`;

  it("reads the tracked declaration when that is all there is", () => {
    root = setup({ "AGENT.md": FORGE });
    expect(readAgentIdentity(root)).toEqual({ name: "Forge", role: "builder", partner: "Atlas" });
  });

  it("lets an untracked AGENT.local.md override the tracked one", () => {
    root = setup({ "AGENT.md": FORGE, "AGENT.local.md": ATLAS });
    expect(readAgentIdentity(root)).toEqual({ name: "Atlas", role: "planner", partner: "Forge" });
  });

  it("works with only the local declaration, so a seat needs no tracked entry", () => {
    root = setup({ "AGENT.local.md": ATLAS });
    expect(readAgentIdentity(root)).toEqual({ name: "Atlas", role: "planner", partner: "Forge" });
  });

  /**
   * An override that silently swallows its own malformation would be the rule 11
   * family: the seat would read as Forge and nothing would say the local file was
   * unreadable. Falling back is correct; falling back SILENTLY on a file the
   * operator deliberately wrote is not, so the fallback is asserted here to pin
   * the behaviour, and the limit is stated in the function's own doc comment.
   */
  it("falls back to the tracked file when the local one has no usable frontmatter", () => {
    root = setup({ "AGENT.md": FORGE, "AGENT.local.md": "# just a heading, no frontmatter\n" });
    expect(readAgentIdentity(root)).toEqual({ name: "Forge", role: "builder", partner: "Atlas" });
  });

  it("returns null when neither file exists", () => {
    root = mkdtempSync(join(tmpdir(), "ident-"));
    expect(readAgentIdentity(root)).toBeNull();
  });

  it("returns null when a declaration is missing the fields that identify a seat", () => {
    root = setup({ "AGENT.md": `---\nrole: builder\n---\n` });
    expect(readAgentIdentity(root)).toBeNull();
  });
});
