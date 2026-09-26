// QA 125, Addition 1 as re-ruled: the greeting may grow by a FIXED label cost but must not grow with the number of
// sessions. Records with N = 0 (just migrated), 1, 10, 50 sessions per seat, each session with its own uuid, handoff
// and sessions[] entry, ALL KEPT (constructed directly and validated by StateSchema, so retention prunes nothing and
// only the render rule is under test). Two layouts: every session of a seat in ONE checkout, and a seat's sessions
// spread over THREE checkouts (the real layout: sia-builder, sia-infra, sia-forge). The greeting is the live
// handleStart text, one child process per (record, seat), with AGENT.local.md naming the seat.
// usage: node c9-greeting.mjs <cand-root> <scratch-dir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S] = process.argv.slice(2);
const ROOT = join(S, "c9-proj");
rmSync(ROOT, { recursive: true, force: true });
execFileSync("git", ["clone", "-q", "--shared", join(S, "c1-proj"), ROOT]);
const schema = await import(pathToFileURL(join(CAND, "open-brain/build/shared/state-schema.js")).href);
const base = JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const store = join(S, "c9-store"); mkdirSync(join(store, "vault"), { recursive: true });
const env = { ...process.env, KNOWLEDGE_V2_DB: join(store, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(store, "as.json"),
  OPEN_BRAIN_VAULT_DIR: join(store, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(store, "s.jsonl"), OPEN_BRAIN_SHADOW_LOG: join(store, "sh.jsonl") };
const SEATS = ["planner", "developer", "qa"];
const LS = { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] };
const uuid = (seatIdx, i) => `${String(seatIdx + 1).repeat(8)}-0000-4000-8000-${String(i).padStart(12, "0")}`;

function record(n, checkouts) {
  const s = JSON.parse(JSON.stringify(base));
  for (const [k, seat] of SEATS.entries()) {
    for (let i = 1; i <= n; i++) {
      const num = 200 + i; // a fixed-width number, so the newest handoff's text is the same length at every N
      const checkout = `sia-${seat.slice(0, 3)}-${(i - 1) % checkouts}`;
      const u = uuid(k, num);
      s.handoffs.push({ seat, pick_up: `${seat} handoff of session ${num}, a fixed-length body.`, watch_out: ["w"], open_questions: [], session: num, loop_state: seat === "planner" ? LS : null, session_uuid: u, checkout });
      s.sessions.push({ n: num, date: "2026-09-26", uuid: u, seat, checkout });
    }
  }
  const v = schema.StateSchema.safeParse(s);
  if (!v.success) throw new Error(JSON.stringify(v.error.issues[0]));
  return schema.serializeState(v.data);
}

const results = [];
for (const checkouts of [1, 3]) {
  for (const n of [0, 1, 10, 50]) {
    if (n === 0 && checkouts === 3) continue;
    writeFileSync(join(ROOT, ".agents/state.json"), record(n, checkouts));
    const st = JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
    for (const seat of SEATS) {
      writeFileSync(join(ROOT, ".agents/AGENT.local.md"), `---\nname: Seat\nrole: ${seat}\npartner: Atlas\n---\n`);
      for (const f of readdirSync(join(ROOT, ".agents/SESSIONS"))) if (/^Session_.*\.md$/.test(f)) rmSync(join(ROOT, ".agents/SESSIONS", f));
      const out = join(S, `c9-${checkouts}co-n${n}-${seat}.txt`);
      execFileSync(process.execPath, ["--input-type=module", "-e", `
        const m = await import(${JSON.stringify(pathToFileURL(join(CAND, "open-brain/build/server.js")).href)});
        const r = await m.handleStart({ project_root: ${JSON.stringify(ROOT)} });
        (await import("node:fs")).writeFileSync(${JSON.stringify(out)}, r.content.map((c) => c.text).join("\\n"));`], { env, stdio: ["ignore", "ignore", "inherit"] });
      const t = readFileSync(out, "utf8");
      results.push({ checkouts, n, seat, handoffs: st.handoffs.length, sessions: st.sessions.length, chars: t.length, words: t.split(/\s+/).filter(Boolean).length, out });
    }
  }
}
console.log("layout      N/seat  seat       handoffs sessions   chars   words");
for (const r of results) console.log(`${String(r.checkouts).padStart(2)} checkout  ${String(r.n).padStart(4)}   ${r.seat.padEnd(10)} ${String(r.handoffs).padStart(6)} ${String(r.sessions).padStart(8)} ${String(r.chars).padStart(7)} ${String(r.words).padStart(7)}`);
// Line diff of each seat's greeting: N=1 vs N=10 vs N=50 (same layout), and N=0 vs N=1.
const lines = (p) => readFileSync(p, "utf8").split("\n");
function diff(a, b) {
  const A = lines(a), B = lines(b), sa = new Set(A), sb = new Set(B);
  return { only_a: A.filter((l) => !sb.has(l)), only_b: B.filter((l) => !sa.has(l)) };
}
for (const checkouts of [1, 3]) for (const seat of SEATS) for (const [x, y] of [[1, 10], [10, 50], ...(checkouts === 1 ? [[0, 1]] : [])]) {
  const a = results.find((r) => r.checkouts === checkouts && r.n === x && r.seat === seat), b = results.find((r) => r.checkouts === checkouts && r.n === y && r.seat === seat);
  const d = diff(a.out, b.out);
  console.log(`\n[${checkouts} checkout(s)] ${seat}: N=${x} -> N=${y}: ${b.chars - a.chars >= 0 ? "+" : ""}${b.chars - a.chars} chars; lines only in N=${x}: ${d.only_a.length}, only in N=${y}: ${d.only_b.length}`);
  for (const l of d.only_a.slice(0, 6)) console.log(`   - ${l.slice(0, 170)}`);
  for (const l of d.only_b.slice(0, 8)) console.log(`   + ${l.slice(0, 170)}`);
}
