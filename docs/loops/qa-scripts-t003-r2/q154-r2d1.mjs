// QA 154: R2-D1 in the WRITER, with a REAL proof. QA 134's P1-P4 rows (c1r2-attack.mjs) carry no proof, so under
// T-003 they refuse at registration and pass vacuously. Here the server PROVES the victim's uuid (the only way a
// T-003 server can write under it), and the uuid is recorded under checkout "sia-builder" in THIS checkout's record.
// Registration shapes are QA 134's: P1 project_dir = this root (the old check's own refusal), P2 a subdirectory,
// P3 the victim's own checkout, P4 no project_dir from a subdirectory cwd. Then ob_state on THIS root.
// usage: node q154-r2d1.mjs <build-root> <scratch-dir> <label>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LABEL = "?"] = process.argv.slice(2);
const ROOT = join(S, "c1r2-proj"); // QA 134's checkout name, so the write's checkout is "c1r2-proj"
const STORE = join(S, "r2d1-store");
const HOMEDIR = join(S, "home");
Object.assign(process.env, {
  KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(STORE, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "score.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(STORE, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: HOMEDIR, USERPROFILE: HOMEDIR,
});
mkdirSync(HOMEDIR, { recursive: true });
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa154", "-c", "user.email=qa154@x"];
if (!existsSync(ROOT)) {
  git(S, "clone", "-q", "--shared", CAND, ROOT);
  git(ROOT, "checkout", "-q", "--detach", "d781b59");
  writeFileSync(join(ROOT, ".agents/state.json"), readFileSync(join(S, "live-rev132.json")));
  execFileSync("node", [join(CAND, "open-brain/build/cli.js"), "state", "migrate", ".agents/state.json"], { cwd: ROOT, stdio: "ignore" });
  git(ROOT, ...ID, "commit", "-qam", "scratch: rev 132 migrated to v3");
}
rmSync(STORE, { recursive: true, force: true });
mkdirSync(STORE, { recursive: true });
const imp = (p) => import(pathToFileURL(join(CAND, "open-brain/build", p)).href);
const W = await imp("shared/state-writer.js");
const PS = await imp("shared/process-session.js");
let nth = 0;
const fresh = async () => import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href + `?r2d1-${++nth}`);
const DIR = PS.byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION);
const PPID = process.ppid, START = PS.processStartTime(PPID);
const prove = (id) => PS.writeProcessSession(DIR, { session_id: id, claude_pid: PPID, proc_start: START, ide: "claude", written_at: new Date().toISOString() });
const reset = () => { process.chdir(S); git(ROOT, "checkout", "-q", "--", ".agents"); git(ROOT, "clean", "-fdq", ".agents"); rmSync(DIR, { recursive: true, force: true }); rmSync(join(S, "p3"), { recursive: true, force: true }); };
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const H = (seat, t) => ({ op: "set_handoff", seat, pick_up: t, watch_out: [], open_questions: [] });
const DEC = { op: "add_decision", title: "qa154 decision", date: "2026-09-27", note: "n" };
const text = (r) => r.content.map((x) => x.text).join("\n");
const one = (t) => t.split("\n").filter(Boolean).slice(0, 2).join(" / ").slice(0, 260);
const V = U(800);
let fails = 0;
const verdict = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${n}${d ? "\n        " + d : ""}`); };
console.log(`# q154-r2d1 on ${LABEL}; server parent ${PPID}`);

const seed = () => {
  const r = W.applyStateOps(ROOT, { session: 800, expected_revision: rec().revision, session_uuid: V, checkout: "sia-builder", render: false, ops: [H("developer", "victim in sia-builder")] });
  if (!r.ok) throw new Error("seed failed: " + JSON.stringify(r));
};
const victim = () => ({ h: rec().handoffs.find((h) => h.session_uuid === V), s: rec().sessions.find((x) => x.uuid === V) });
const shape = (v) => `victim handoff "${v.h?.pick_up}" checkout ${v.h?.checkout}; session record checkout ${v.s?.checkout}`;

async function attack(name, projectDir, cwd, ops, extra = {}) {
  reset(); seed(); prove(V);
  const rev0 = rec().revision;
  if (projectDir === "p3") {
    const other = join(S, "p3", "sia-builder");
    mkdirSync(join(other, ".agents"), { recursive: true });
    cpSync(join(ROOT, ".agents/state.json"), join(other, ".agents/state.json"));
    projectDir = other;
  }
  process.chdir(cwd);
  const s = await fresh();
  const reg = await s.handleSetSession(projectDir === undefined ? {} : { project_dir: projectDir });
  const w = await s.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops, ...extra });
  const v = victim();
  const ok = w.isError === true && /sia-builder/.test(text(w)) && v.h?.pick_up === "victim in sia-builder" && v.h?.checkout === "sia-builder" && v.s?.checkout === "sia-builder" && rec().revision === rev0;
  verdict(name, ok, `registration: ${reg.isError ? "REFUSED" : "accepted"}: ${one(text(reg))}\n        ob_state: ${one(text(w))}\n        ${shape(v)}; revision ${rev0} -> ${rec().revision}`);
  process.chdir(S);
}

await attack("P1w project_dir = THIS root (the old registration check's own refusal): the writer refuses", ROOT, ROOT, [H("developer", "P1: replaced")]);
await attack("P2w project_dir = a subdirectory of this checkout: the writer refuses", join(ROOT, "open-brain"), ROOT, [H("developer", "P2: replaced")]);
await attack("P3w project_dir = the victim's own checkout (basename sia-builder): the writer refuses", "p3", ROOT, [H("developer", "P3: replaced")]);
await attack("P4w no project_dir, server cwd a subdirectory: the writer refuses", undefined, join(ROOT, "open-brain"), [H("developer", "P4: replaced")]);
await attack("N1 a write with NO handoff (add_decision) is refused too, so the session record's checkout cannot be moved first", ROOT, ROOT, [DEC]);
await attack("N2 a dry run is refused the same way", ROOT, ROOT, [H("developer", "dry")], { dry_run: true });

// N3 two-step: a non-handoff write, then set_handoff. Catches a check that looks only at set_handoff batches.
reset(); seed(); prove(V);
{
  process.chdir(ROOT);
  const s = await fresh();
  const w1 = await s.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [DEC] });
  const w2 = await s.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [H("developer", "N3: replaced")] });
  const v = victim();
  verdict("N3 two steps (a decision, then a handoff) cannot move the session record and then replace the handoff", v.h?.pick_up === "victim in sia-builder" && v.s?.checkout === "sia-builder",
    `step 1: ${one(text(w1))}\n        step 2: ${one(text(w2))}\n        ${shape(v)}`);
}

// Writer level: the same comparison with no server at all.
reset(); seed();
{
  const r = W.applyStateOps(ROOT, { session: 801, expected_revision: rec().revision, session_uuid: V, ops: [H("developer", "writer: replaced")] });
  const v = victim();
  verdict("W1 applyStateOps(session_uuid = the victim's, checkout defaulted to this root's basename) refuses", r.ok === false && v.h?.pick_up === "victim in sia-builder", `${r.ok ? "applied" : r.error}\n        ${shape(v)}`);
  const r2 = W.applyStateOps(ROOT, { session: 801, expected_revision: rec().revision, session_uuid: V, checkout: "sia-builder", ops: [H("developer", "same checkout")] });
  console.log(`INFO    W2 the same uuid writing AS checkout sia-builder (its own) is ${r2.ok ? "applied" : "refused: " + r2.error}`);
}

// Must NOT be refused: this checkout's own recorded session, and a legacy (checkout null) session record.
reset();
{
  process.chdir(ROOT);
  const SELF = U(810);
  W.applyStateOps(ROOT, { session: 810, expected_revision: rec().revision, session_uuid: SELF, checkout: "c1r2-proj", render: false, ops: [H("developer", "local")] });
  prove(SELF);
  const s = await fresh();
  const w = await s.handleState({ project_root: ROOT, session: 811, expected_revision: rec().revision, ops: [H("developer", "still local")] });
  verdict("K1 a session recorded under THIS checkout still writes", !w.isError && rec().handoffs.find((h) => h.session_uuid === SELF)?.pick_up === "still local", one(text(w)));
  const legacy = rec().sessions.find((x) => x.checkout === null);
  prove(legacy.uuid);
  const s2 = await fresh();
  const w2 = await s2.handleState({ project_root: ROOT, session: 812, expected_revision: rec().revision, ops: [H("qa", "under the legacy uuid")] });
  const after = rec().sessions.find((x) => x.uuid === legacy.uuid);
  verdict("K2 a legacy session record (checkout null) is not refused (the ruling's stated exception)", !w2.isError, `${legacy.uuid.slice(0, 8)} n ${legacy.n}: ${one(text(w2))}; record now checkout ${after?.checkout}, seat ${after?.seat}`);
  process.chdir(S);
}

// Edge (INFO): a handoff whose SESSION record is gone (retention drops the two arrays separately). The comparison reads
// sessions[] only, as the old registration check did.
reset(); seed(); prove(V);
{
  const st = rec();
  st.sessions = st.sessions.filter((x) => x.uuid !== V);
  writeFileSync(join(ROOT, ".agents/state.json"), JSON.stringify(st, null, 2) + "\n");
  process.chdir(ROOT);
  const s = await fresh();
  const w = await s.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [H("developer", "orphan: replaced")] });
  const v = victim();
  console.log(`INFO    E1 the victim's handoff with NO session record (orphaned): ob_state ${w.isError ? "refused" : "applied"}; ${shape(v)}`);
  process.chdir(S);
}

reset();
console.log(`\n${fails} BROKEN`);
process.exit(0);
