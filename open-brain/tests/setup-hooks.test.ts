/**
 * R179-5 (QA 125's D3): setup.mjs registers the SessionEnd hook, so T179-2's
 * handoff guard does not rest on a README step. QA's check 7 found a machine
 * set up the documented way with SessionStart and no SessionEnd; the first row
 * is that machine.
 */
import { describe, it, expect } from "vitest";
import { join } from "node:path";
// @ts-expect-error — a plain .mjs module outside the TypeScript project
import { withSessionHooks } from "../../scripts/setup-hooks.mjs";

type Entry = { matcher: string; hooks: Array<{ type: string; command: string }> };
type Settings = { hooks?: Record<string, Entry[]>; [k: string]: unknown };
const run = (s: Settings, dir = OB): { settings: Settings; changed: boolean; notes: string[] } => withSessionHooks(s, dir);

const OB = join("C:", "repo", "open-brain");
const cmd = (file: string, dir = OB) => `node "${join(dir, "build", file)}"`;
const commands = (s: Settings, event: string) => (s.hooks?.[event] ?? []).flatMap((e) => e.hooks.map((h) => h.command));

describe("setup.mjs hook registration (R179-5)", () => {
  it("QA's machine: SessionStart already registered and no SessionEnd — SessionEnd is ADDED, SessionStart untouched", () => {
    const before: Settings = { hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: cmd("cli-bootstrap.js") }] }] } };
    const r = run(before);
    expect(r.changed).toBe(true);
    expect(commands(r.settings, "SessionEnd")).toEqual([cmd("cli-session-end.js")]);
    expect(commands(r.settings, "SessionStart")).toEqual([cmd("cli-bootstrap.js")]);
    expect(r.notes).toContain("SessionEnd hook registered (cli-session-end.js)");
  });

  it("an empty settings file gets both, and other settings keys survive", () => {
    const r = run({ model: "x" });
    expect(r.settings.model).toBe("x");
    expect(commands(r.settings, "SessionStart")).toEqual([cmd("cli-bootstrap.js")]);
    expect(commands(r.settings, "SessionEnd")).toEqual([cmd("cli-session-end.js")]);
  });

  it("is idempotent: a second run changes nothing and registers nothing twice — including across a path-spelling difference", () => {
    const once = run({}).settings;
    const twice = run(once);
    expect(twice.changed).toBe(false);
    const slashed: Settings = JSON.parse(JSON.stringify(once).replace(/\\\\/g, "/"));
    const again = run(slashed);
    expect(commands(again.settings, "SessionEnd")).toHaveLength(1);
    expect(commands(again.settings, "SessionStart")).toHaveLength(1);
  });

  it("leaves another tool's SessionEnd hook alone, and removes the retired knowledge-mcp one", () => {
    const r = run({ hooks: { SessionEnd: [
      { matcher: "", hooks: [{ type: "command", command: "node other-tool.js" }] },
      { matcher: "", hooks: [{ type: "command", command: "node knowledge-mcp/end.js" }] },
    ] } });
    expect(commands(r.settings, "SessionEnd")).toEqual(["node other-tool.js", cmd("cli-session-end.js")]);
  });
});
