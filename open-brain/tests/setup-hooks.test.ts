/**
 * R179-5 (QA 125's D3): setup.mjs registers the SessionEnd hook, so T179-2's
 * handoff guard does not rest on a README step. QA's check 7 found a machine
 * set up the documented way with SessionStart and no SessionEnd; the first row
 * is that machine.
 */
import { describe, it, expect } from "vitest";
import { join } from "node:path";
// @ts-expect-error — a plain .mjs module outside the TypeScript project
import { withSessionHooks, withCursorMcp, withCursorSessionHook } from "../../scripts/setup-hooks.mjs";

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

// T-235 P2-1: Cursor entries pin the ABSOLUTE Node that ran setup. A bare `node` resolved to a
// different Node under cursor-agent (better-sqlite3 NODE_MODULE_VERSION 127 vs 137).
describe("setup.mjs Cursor registration pins the running Node (T-235 P2-1)", () => {
  const NODE = String.raw`C:\Program Files\nodejs\node.exe`;
  const SERVER = String.raw`C:\repo\open-brain\build\server.js`;
  const BOOT = String.raw`C:\repo\open-brain\build\cli-bootstrap.js`;
  const NODE24 = String.raw`D:\node24\node.exe`;
  const hookCmd = `"C:/Program Files/nodejs/node.exe" "C:/repo/open-brain/build/cli-bootstrap.js" --ide cursor`;
  type Mcp = { mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> };
  type Hooks = { version?: number; hooks: { sessionStart?: Array<{ command: string }> } };
  const mcp = (c: unknown, node = NODE): { config: Mcp; changed: boolean } => withCursorMcp(c, SERVER, node);
  const hook = (c: unknown, node = NODE): { config: Hooks; changed: boolean } => withCursorSessionHook(c, BOOT, node);

  it("MCP: command is the absolute node path, not the bare word", () => {
    const r = mcp({});
    expect(r.config.mcpServers["open-brain"].command).toBe(NODE);
    expect(r.config.mcpServers["open-brain"].args).toEqual([SERVER]);
    expect(r.config.mcpServers["open-brain"].env?.OPEN_BRAIN_IDE).toBe("cursor");
  });

  it("MCP: a re-run UPGRADES an existing bare-node entry, keeping other env and servers", () => {
    const old = { mcpServers: {
      "open-brain": { command: "node", args: [SERVER], env: { OPEN_BRAIN_IDE: "cursor", KEEP: "1" } },
      other: { command: "x", args: [] },
    } };
    const r = mcp(old);
    expect(r.changed).toBe(true);
    expect(r.config.mcpServers["open-brain"].command).toBe(NODE);
    expect(r.config.mcpServers["open-brain"].env?.KEEP).toBe("1");
    expect(r.config.mcpServers.other).toEqual({ command: "x", args: [] });
  });

  it("MCP: idempotent once upgraded", () => {
    const once = mcp({}).config;
    expect(mcp(once).changed).toBe(false);
  });

  it("MCP: a different Node on a later run is picked up (the entry follows the running Node)", () => {
    const r = mcp(mcp({}).config, NODE24);
    expect(r.changed).toBe(true);
    expect(r.config.mcpServers["open-brain"].command).toBe(NODE24);
  });

  it("hook: command runs the absolute node (forward slashes, quoted) with --ide cursor", () => {
    const r = hook({ version: 1, hooks: {} });
    expect(r.config.hooks.sessionStart).toEqual([{ command: hookCmd }]);
  });

  it("hook: a bare-node entry and an untagged entry are REPLACED, never left beside the new one", () => {
    const bare = `node "C:/repo/open-brain/build/cli-bootstrap.js" --ide cursor`;
    const untagged = `node "C:/repo/open-brain/build/cli-bootstrap.js"`;
    const r = hook({ version: 1, hooks: { sessionStart: [{ command: bare }, { command: untagged }, { command: "other.cmd" }] } });
    expect(r.changed).toBe(true);
    expect(r.config.hooks.sessionStart).toEqual([{ command: "other.cmd" }, { command: hookCmd }]);
  });

  it("hook: idempotent, and keeps unrelated hook events", () => {
    const once = hook({ version: 1, hooks: { stop: [{ command: "s" }] } }).config;
    expect(hook(once).changed).toBe(false);
    expect((once.hooks as Record<string, unknown>).stop).toEqual([{ command: "s" }]);
  });
});
