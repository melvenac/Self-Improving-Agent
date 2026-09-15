#!/usr/bin/env node
// Replay every eligible past session through the PRODUCTION shadow evaluator.
//
// The session-end shadow stage only ever scores the session that just ended, so
// the log grows one line per session and sat at 8 scored sessions — below
// MIN_SESSIONS_FOR_VERDICT. recall_log and feedback_log already hold the whole
// history, so the same evaluator can be replayed over all of it at once.
//
// Read-only by construction: the DB is opened readonly and evaluateSession
// deliberately does not touch recall_count or last_recalled_at.
//
// READ THE CONFOUND BEFORE USING THE NUMBERS:
// open-brain/docs/shadow-recall-ranking-2026-09-14.md — maturity and
// recency are read as they are TODAY, but helpful ratings are what promote
// maturity, so replaying a session scores it partly on promotions its own
// labels caused. Strategies that touch matureBoost/provenBoost are confounded.
import Database from "better-sqlite3";
import { homedir } from "os";
import { evaluateSession } from "../build/pipelines/shadow/evaluate.js";

const LIMIT = Number(process.env.SHADOW_LIMIT ?? 5);
const db = new Database(homedir() + "/.claude/open-brain/knowledge-v2.db", { readonly: true });

const eligible = db.prepare(`
  SELECT f.session_uuid u
  FROM feedback_log f
  GROUP BY f.session_uuid
  HAVING SUM(CASE WHEN f.rating='helpful' THEN 1 ELSE 0 END) > 0
     AND (SELECT COUNT(DISTINCT query) FROM recall_log r WHERE r.session_uuid=f.session_uuid) > 0
  ORDER BY f.session_uuid
`).all().map((r) => r.u);

const acc = new Map();
const perSession = [];
let skipped = 0;

for (const u of eligible) {
  const ev = evaluateSession(db, u, { limit: LIMIT });
  if (ev.skipped) { skipped++; continue; }
  const row = { u, scores: {} };
  for (const s of ev.scores) {
    const a = acc.get(s.strategy) ?? { n: 0, ndcg: 0, mrr: 0, prec: 0, harmful: 0, labeled: 0, returned: 0 };
    a.n++; a.ndcg += s.ndcg; a.mrr += s.mrr; a.prec += s.precision;
    a.harmful += s.harmful; a.labeled += s.labeled; a.returned += s.returned;
    acc.set(s.strategy, a);
    row.scores[s.strategy] = s;
  }
  perSession.push(row);
}

console.log(`eligible=${eligible.length} evaluated=${perSession.length} skipped=${skipped} limit=${LIMIT}`);
console.log("\nDirections: nDCG higher better | MRR higher better | precision higher better | harmful LOWER better\n");
console.log("strategy          sessions   nDCG     MRR    prec   harmful  labeled/returned");
for (const r of [...acc.entries()].map(([k, a]) => ({ k, ...a })).sort((x, y) => y.ndcg / y.n - x.ndcg / x.n)) {
  console.log(
    `${r.k.padEnd(16)} ${String(r.n).padStart(6)}  ${(r.ndcg / r.n).toFixed(4)}  ${(r.mrr / r.n).toFixed(4)}  ` +
    `${(r.prec / r.n).toFixed(4)}  ${String(r.harmful).padStart(6)}   ${r.labeled}/${r.returned}`
  );
}

const h2h = (a, b) => {
  let win = 0, loss = 0, tie = 0, diff = 0;
  for (const s of perSession) {
    const x = s.scores[a]?.ndcg, y = s.scores[b]?.ndcg;
    if (x === undefined || y === undefined) continue;
    diff += x - y;
    if (Math.abs(x - y) < 1e-12) tie++; else if (x > y) win++; else loss++;
  }
  return { win, loss, tie, meanDiff: diff / (perSession.length || 1) };
};

console.log("\nPaired per-session head-to-head vs live, on nDCG (higher better):");
for (const v of ["no_maturity", "bm25_only", "maturity_strong", "no_recency", "recency_strong"]) {
  const r = h2h(v, "live");
  console.log(`  ${v.padEnd(16)} win ${r.win}  loss ${r.loss}  tie ${r.tie}   mean nDCG diff ${r.meanDiff >= 0 ? "+" : ""}${r.meanDiff.toFixed(4)}`);
}

console.log("\nSessions where the strategy reordered results at all (nDCG differs from live):");
for (const v of ["no_maturity", "bm25_only", "maturity_strong", "no_recency", "recency_strong"]) {
  const n = perSession.filter((s) => Math.abs((s.scores[v]?.ndcg ?? 0) - (s.scores.live?.ndcg ?? 0)) > 1e-12).length;
  console.log(`  ${v.padEnd(16)} ${n}/${perSession.length}`);
}
