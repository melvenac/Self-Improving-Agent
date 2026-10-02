#!/usr/bin/env node
// QA 252: Jev calibration 1, Phase 2, step 4. One live `harness shadow-done` per runlist row, in runlist order,
// one process at a time, into docs/loops/jev-calibration-1/records with this set's own ledger (slice four's
// ledger is not touched). The key is read from HKCU\Environment into this process only, checked against the
// fingerprint, passed to each child in its environment, and never printed.
//   - Never re-ask: a row is called once. Only `transport`, `rate-limited` or `overloaded` may be retried, at most
//     3 retries in total over the whole run.
//   - `auth` stops everything.
//   - Spend cap $0.50 on the summed usage, priced conservatively (PRICE_PER_TOKEN below; see the report).
//   - A shadow-done that exits non-zero, or names no record, stops the run (it is investigated, not retried).
// Usage (from C:/qa-scratch/qa252-wt): node docs/loops/qa-252/run-calls.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

process.chdir("C:/qa-scratch/qa252-wt");

const RUNLIST = "docs/loops/jev-calibration-1/runlist.json";
const RECORDS = "docs/loops/jev-calibration-1/records";
const LEDGER = `${RECORDS}/attempts.jsonl`;
const LOGS = "C:/qa-scratch/qa252-logs";
const FINGERPRINT = "728B667EFF";
const RETRYABLE = new Set(["transport", "rate-limited", "overloaded"]);
const MAX_RETRIES = 3;
const CAP_USD = 0.5;
// Conservative: the brief puts QA 248's price at about $0.0001 per ~2,000-token call (~$5e-8 a token).
// This uses $1e-6 a token, 20 times that, for both input and output, so the cap trips early, never late.
const PRICE_PER_TOKEN = 1e-6;

const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "TYPESAFE_API_KEY"], { encoding: "utf8" });
const m = out.split(/\r?\n/).map((l) => l.match(/TYPESAFE_API_KEY\s+REG_(?:EXPAND_)?SZ\s+(.*)$/)).find(Boolean);
if (!m) { console.log("run-calls: TYPESAFE_API_KEY not in HKCU\\Environment; STOP"); process.exit(2); }
const key = m[1].trim();
const fp = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 10).toUpperCase();
console.log(`key: fingerprint (sha256, first 10 hex) ${fp}; expected ${FINGERPRINT}; match ${fp === FINGERPRINT}`);
if (fp !== FINGERPRINT) process.exit(2);

mkdirSync(LOGS, { recursive: true });
const rows = JSON.parse(readFileSync(RUNLIST, "utf8"));
const env = { ...process.env, TYPESAFE_API_KEY: key };
let retries = 0;
let tokens = 0;
let calls = 0;
const summary = [];
let stopReason = null;

function call(row, tag) {
  const args = [
    "open-brain/build/harness/cli.js", "shadow-done",
    "--pr", String(row.pr), "--merge-commit", row.merge_commit, "--scored-sha", row.scored_sha,
    "--base-sha", row.base_sha, "--dt", row.dt, "--checks", row.checks,
    "--mode", "live", "--records", RECORDS, "--ledger", LEDGER,
  ];
  const started = new Date().toISOString();
  const r = spawnSync("node", args, { env, encoding: "utf8" });
  const ended = new Date().toISOString();
  calls += 1;
  const base = `${LOGS}/live-${String(row.pr).padStart(3, "0")}-${row.case_id}${tag}`;
  writeFileSync(`${base}.cmd`, `cwd C:/qa-scratch/qa252-wt\nnode ${args.join(" ")}\nstarted ${started}\nended ${ended}\nexit ${r.status}\n`);
  writeFileSync(`${base}.out`, r.stdout ?? "");
  writeFileSync(`${base}.err`, r.stderr ?? "");
  const recordPath = (r.stdout ?? "").split(/\r?\n/)[0]?.trim();
  let rec = null;
  if (recordPath && existsSync(recordPath)) rec = JSON.parse(readFileSync(recordPath, "utf8"));
  const used = (rec?.usage?.input_tokens ?? 0) + (rec?.usage?.output_tokens ?? 0);
  tokens += used;
  return { status: r.status, recordPath, outcome: rec?.outcome_class ?? null, verdict: rec?.decision?.verdict ?? null, used };
}

for (const row of rows) {
  let res = call(row, "");
  const line = (res2, tag) => `${String(row.pr).padStart(3)} ${row.case_id}${tag}: exit ${res2.status}, outcome ${res2.outcome}, decision ${res2.verdict}, tokens ${res2.used}`;
  console.log(line(res, ""));
  summary.push({ pr: row.pr, case_id: row.case_id, attempt: 1, ...res });
  let n = 1;
  while (res.outcome !== null && RETRYABLE.has(res.outcome) && retries < MAX_RETRIES) {
    retries += 1; n += 1;
    res = call(row, `-retry${n - 1}`);
    console.log(line(res, ` (retry ${retries} of ${MAX_RETRIES})`));
    summary.push({ pr: row.pr, case_id: row.case_id, attempt: n, ...res });
  }
  if (res.outcome === "auth") { stopReason = `auth on ${row.case_id}`; break; }
  if (res.status !== 0 || res.outcome === null) { stopReason = `shadow-done exit ${res.status}, record ${res.recordPath || "none"} on ${row.case_id}`; break; }
  if (tokens * PRICE_PER_TOKEN >= CAP_USD) { stopReason = `spend cap reached after ${row.case_id}`; break; }
}

const usd = tokens * PRICE_PER_TOKEN;
console.log(`calls ${calls}; retries ${retries}; tokens ${tokens}; conservative spend $${usd.toFixed(4)} (cap $${CAP_USD}); stop ${stopReason ?? "none: every row called"}`);
writeFileSync(`${LOGS}/run-calls.summary.json`, JSON.stringify({ calls, retries, tokens, conservative_usd: usd, stopReason, summary }, null, 2));
process.exit(stopReason ? 1 : 0);
