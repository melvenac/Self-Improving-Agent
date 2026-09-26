// Registers a session uuid and applies one ob_state batch through the candidate build's handlers.
// argv: project_root uuid session expected_revision ops-json
const s = await import("file:///C:/qa-scratch/cand/open-brain/build/server.js");
const [root, uuid, session, rev, ops] = process.argv.slice(2);
const a = await s.handleSetSession({ session_id: uuid, project_dir: root });
for (const c of a.content) console.log("[ob_set_session] " + c.text.split("\n")[0]);
const r = await s.handleState({ project_root: root, session: Number(session), expected_revision: Number(rev), ops: JSON.parse(ops) });
for (const c of r.content) console.log(c.text);
if (r.isError) process.exit(1);
