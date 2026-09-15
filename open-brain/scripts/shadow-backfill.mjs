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
// REPAIRED IN LOOP 6. Three present-tense inputs used to leak in, each standing
// in for an as-of-then value, and every one of them favoured a different answer:
//   1. maturity/success_rate were read as they are TODAY, but helpful ratings are
//      what promote maturity — so a session was scored partly on promotions its
//      own labels caused. Circular; hit matureBoost/provenBoost hardest.
//   2. the candidate pool included entries created AFTER the session, which it
//      could never have recalled and so could never have labelled. Penalised high
//      recency decay, which is what surfaces new entries.
//   3. the recency clock was `now`, not the replayed moment, ageing every entry by
//      the same constant and collapsing the divisor ratio that actually ranks.
//      Weakened decay's effect — pushing OPPOSITE to (2).
// (2) and (3) pushed opposite ways on the same rows and may have partly cancelled,
// which is worse than either alone: cancellation manufactures a plausible middle
// that reads as a measurement. All three are fixed; evaluateSession now derives
// the as-of moment from the session's earliest recall and reconstructs lifecycle
// state from feedback_log up to it.
//
// Superseded: open-brain/docs/shadow-recall-ranking-2026-09-14.md — its numbers
// were produced on the unrepaired instrument and must not be pooled with these.
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
let noAsOf = 0;
let totalExcluded = 0;
let coverage = null;

for (const u of eligible) {
  const ev = evaluateSession(db, u, { limit: LIMIT });
  if (ev.skipped) { skipped++; continue; }
  // A session with no logged recall has no moment to replay from, so it is NOT a
  // faithful replay. Counted rather than hidden: before Loop 6 it was
  // indistinguishable in the output from a correctly anchored one.
  if (!ev.asOf) noAsOf++;
  totalExcluded += ev.excludedAsNotYetCreated;
  if (ev.coverage) coverage = ev.coverage;
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
console.log(
  `replay anchoring: ${perSession.length - noAsOf}/${perSession.length} sessions anchored to their own recall time` +
  (noAsOf ? `, ${noAsOf} UNANCHORED (no logged recall — not a faithful replay)` : "")
);
console.log(`entries excluded as not-yet-created, summed over sessions: ${totalExcluded}`);
if (coverage) {
  console.log(
    `feedback_log coverage: ${coverage.ratingsTotal} logged ratings; ` +
    `${coverage.unlogged} non-neutral ratings known to the live counters but NOT in the log` +
    (coverage.unlogged ? " — replayed maturity is a LOWER BOUND for those entries" : "")
  );
}
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

/**
 * Two-sided sign test on the win/loss split, ties discarded.
 *
 * Added in Loop 8 R2 because the aggregate means invite exactly the error the
 * brief forbids: recency_0_02 leads live by +0.0134 mean nDCG, which reads as a
 * result until you notice the paired split behind it is 19-15 — a coin flip.
 * Reporting the mean without this makes noise look like a finding.
 */
function signTestP(win, loss) {
  const n = win + loss;
  if (n === 0) return 1;
  const logC = (n, k) => {
    let s = 0;
    for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
    return s;
  };
  const k = Math.min(win, loss);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += Math.exp(logC(n, i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

// Derived from the strategies actually present, not a hardcoded list. The list
// was hardcoded and silently omitted every strategy added after it was written —
// this loop's three recency points included, which is the whole subject of R2.
const VARIANTS = [...acc.keys()].filter((k) => k !== "live");

console.log("\nPaired per-session head-to-head vs live, on nDCG (higher better):");
console.log("  (p = two-sided sign test on win/loss, ties discarded; p>0.05 means the split is not distinguishable from chance)");
for (const v of VARIANTS) {
  const r = h2h(v, "live");
  const p = signTestP(r.win, r.loss);
  console.log(
    `  ${v.padEnd(16)} win ${String(r.win).padStart(2)}  loss ${String(r.loss).padStart(2)}  tie ${String(r.tie).padStart(2)}` +
    `   mean nDCG diff ${r.meanDiff >= 0 ? "+" : ""}${r.meanDiff.toFixed(4)}   p=${p.toFixed(3)}${p > 0.05 ? "  (not significant)" : ""}`
  );
}

console.log("\nSessions where the strategy reordered results at all (nDCG differs from live):");
for (const v of VARIANTS) {
  const n = perSession.filter((s) => Math.abs((s.scores[v]?.ndcg ?? 0) - (s.scores.live?.ndcg ?? 0)) > 1e-12).length;
  console.log(`  ${v.padEnd(16)} ${n}/${perSession.length}`);
}
