// One "server" writing one handoff with NO ob_set_session, as a server does
// after a reconnect. Prints one JSON line: what happened and its own ppid.
import { readFileSync } from "fs";
import { join } from "path";
import { handleState } from "../../src/server.js";

const [root, label, session] = process.argv.slice(2);
const s = JSON.parse(readFileSync(join(root, ".agents", "state.json"), "utf-8")) as { revision: number };
const r = await handleState({
  project_root: root, session: Number(session), expected_revision: s.revision,
  ops: [{ op: "set_handoff", seat: "developer", pick_up: label, watch_out: [], open_questions: [] }],
});
console.log(JSON.stringify({ isError: r.isError ?? false, text: r.content[0].text, ppid: process.ppid }));
