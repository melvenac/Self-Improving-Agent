// QA 134 check 5 (R179-5): setup-hooks.mjs's withSessionHooks on the cases a machine can be in. Pure; no home touched.
// usage: node c5r2-hooks.mjs <cand-root>
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const [CAND] = process.argv.slice(2);
const { withSessionHooks } = await import(pathToFileURL(join(CAND, "scripts/setup-hooks.mjs")).href);
const OB = join(CAND, "open-brain");
const fwd = (p) => p.split("\\").join("/");
const short = (c) => fwd(c).replace(/.*\/Worktrees\//, "").replace(/.*qa-scratch\/qa134\//, "");
const cmds = (s) => Object.fromEntries(Object.entries(s.hooks).map(([e, v]) => [e, Array.isArray(v) ? v.flatMap((x) => x.hooks.map((h) => short(h.command))) : v]));
const cases = {
  "fresh machine: {}": {},
  "undefined settings": undefined,
  "SessionStart only (set up before R179-5)": { hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: `node "${join(OB, "build", "cli-bootstrap.js")}"` }] }] } },
  "forward-slash spelling of both (an earlier install)": { hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: `node "${fwd(join(OB, "build", "cli-bootstrap.js"))}"` }] }], SessionEnd: [{ matcher: "", hooks: [{ type: "command", command: `node "${fwd(join(OB, "build", "cli-session-end.js"))}"` }] }] } },
  "SessionEnd registered from ANOTHER checkout (a seat)": { hooks: { SessionEnd: [{ matcher: "", hooks: [{ type: "command", command: 'node "C:/Users/x/Worktrees/sia-builder/open-brain/build/cli-session-end.js"' }] }] } },
  "stale knowledge-mcp SessionEnd + another tool's SessionEnd": { hooks: { SessionEnd: [{ matcher: "", hooks: [{ type: "command", command: "node knowledge-mcp/end.js" }] }, { matcher: "", hooks: [{ type: "command", command: "other-tool end" }] }] } },
  "hooks.SessionEnd not an array (malformed)": { hooks: { SessionEnd: {} } },
};
for (const [name, s] of Object.entries(cases)) {
  try {
    const r = withSessionHooks(s, OB);
    const again = withSessionHooks(r.settings, OB);
    console.log(`${name}\n  changed=${r.changed}; notes: ${r.notes.join(" | ")}\n  result: ${JSON.stringify(cmds(r.settings))}\n  re-run changed=${again.changed}`);
  } catch (e) { console.log(`${name}\n  THREW: ${e.message}`); }
}
