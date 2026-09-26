// QA 125 check 3, second instrument: an independent recount of per-session records removed across state.json history.
// Own code, not the candidate's: git log over the file, parent vs child, keyed seat@session (v1: @session) and
// last_session/sessions uuid. Merges: a record is counted when it is in some parent and absent from the merge AND
// (in every parent OR not in the merge base). usage: node c3-recount.mjs <repo>
import { execFileSync } from "node:child_process";
const R = process.argv[2];
const g = (...a) => execFileSync("git", a, { cwd: R, encoding: "utf8", maxBuffer: 1 << 30 }).trim();
const load = (c) => { try { return JSON.parse(g("show", `${c}:.agents/state.json`)); } catch { return null; } };
const keys = (s) => {
  const k = new Set(); if (!s) return k;
  const hs = Array.isArray(s.handoffs) ? s.handoffs : s.handoff ? [s.handoff] : [];
  for (const h of hs) k.add(h.session_uuid ? `h:${h.session_uuid}` : `h:@${h.session}`); // seat dropped so v1->v2 is not a removal
  const ss = Array.isArray(s.sessions) ? s.sessions : s.last_session ? [s.last_session] : [];
  for (const x of ss) k.add(x.uuid ? `s:${x.uuid}` : `s#${x.n}`);
  return k;
};
const commits = g("rev-list", "--parents", "HEAD", "--", ".agents/state.json").split("\n").map((l) => l.split(" "));
let n = 0, hN = 0, sN = 0; const per = [];
for (const [c] of commits) {
  const ps = g("rev-list", "--parents", "-n", "1", c).split(" ").slice(1);
  const after = keys(load(c));
  const parents = ps.map((p) => keys(load(p)));
  let removed = [];
  if (ps.length === 1) removed = [...parents[0]].filter((k) => !after.has(k));
  else if (ps.length > 1) {
    const base = keys(load(g("merge-base", ...ps)));
    const all = new Set(parents.flatMap((p) => [...p]));
    removed = [...all].filter((k) => !after.has(k) && (parents.every((p) => p.has(k)) || !base.has(k)));
  }
  for (const k of removed) { n++; k.startsWith("h") ? hN++ : sN++; }
  if (removed.length) per.push(`${c.slice(0, 7)} ${removed.join(" ")}`);
}
console.log(`commits touching state.json: ${commits.length}; removals: ${n} (handoffs ${hN}, sessions ${sN})`);
console.log(per.join("\n"));
