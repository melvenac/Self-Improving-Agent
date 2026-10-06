#!/usr/bin/env node
// QA 285: Jev calibration 2, DEVELOPMENT phase, live. One `harness shadow-done --request … --mode live --phase dev`
// per DEV runlist row, in runlist order, one process at a time, into docs/loops/jev-calibration-2/records with ledger
// docs/loops/jev-calibration-2/records/attempts.jsonl. Held-out rows are never read for calling: the loop is over
// runlist.phases.dev only, and every row's case_id is re-checked against split.json's held_out ids before its call.
// The key is read from HKCU\Environment into this process only, checked against the fingerprint, passed to each
// child in its environment, and never printed.
//   - Never re-ask a row that got an answer. Retry only on transport, rate-limited or overloaded; at most 3 retries
//     per row.
//   - FrozenWireTransport files EVERY non-2xx HTTP status under `transport`, so the HTTP status is read from the
//     record's note: 401/403 is treated as `auth` (stop everything); 413 is a size rejection (recorded, not cut,
//     not retried); any other 4xx is recorded and not retried; 429, 5xx/529 and status-less transport are retried.
//   - No spend cap (Aaron, 2026-10-05).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RUN = "C:/qa-scratch/qa285-run";
const HERE = join(RUN, "docs/loops/jev-calibration-2");
const RECORDS = join(HERE, "records");
const LEDGER = join(RECORDS, "attempts.jsonl");
const LOGS = "C:/qa-tmp/qa285/live-logs";
const FINGERPRINT = "728B667EFF";
const MAX_RETRIES_PER_ROW = 3;
const TSX = join(RUN, "open-brain/node_modules/tsx/dist/cli.mjs");
// The frozen CLI cannot send live (no fetchImpl reaches FrozenWireTransport); see shadow-done-fetch.ts.
const SHIM = "C:/qa-tmp/qa285/shadow-done-fetch.mts";

const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "TYPESAFE_API_KEY"], { encoding: "utf8" });
const m = out.split(/\r?\n/).map((l) => l.match(/TYPESAFE_API_KEY\s+REG_(?:EXPAND_)?SZ\s+(.*)$/)).find(Boolean);
if (!m) { console.log("run-live: TYPESAFE_API_KEY not in HKCU\\Environment; STOP"); process.exit(2); }
const key = m[1].trim();
const fp = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 10).toUpperCase();
console.log(`key: fingerprint (sha256, first 10 hex) ${fp}; expected ${FINGERPRINT}; match ${fp === FINGERPRINT}`);
if (fp !== FINGERPRINT) process.exit(2);

const runlist = JSON.parse(readFileSync(join(HERE, "runlist.json"), "utf8"));
const split = JSON.parse(readFileSync(join(RUN, "docs/loops/jev-calibration-2-split.json"), "utf8"));
const heldIds = new Set(split.held_out.case_ids);
if (runlist.phases.dev.length !== 33) { console.log(`run-live: expected 33 dev rows, got ${runlist.phases.dev.length}; STOP`); process.exit(2); }
// Run in slices (argv: from to) so each foreground invocation fits the tool's time limit; rows stay in runlist order.
const from = Number(process.argv[2] ?? 0), to = Number(process.argv[3] ?? 33);
const rows = runlist.phases.dev.slice(from, to);
console.log(`rows ${from}..${to - 1} of the dev phase (${rows.length})`);
mkdirSync(LOGS, { recursive: true });
mkdirSync(RECORDS, { recursive: true });
const env = { ...process.env, TYPESAFE_API_KEY: key };
let calls = 0, retries = 0, inTok = 0, outTok = 0;
const summary = [];
let stopReason = null;

function httpStatus(note) { const mm = /\(HTTP (\d+|none)\)/.exec(note ?? ""); return mm && mm[1] !== "none" ? Number(mm[1]) : null; }

function call(row, tag) {
  if (heldIds.has(row.case_id)) throw new Error(`refusing held-out id ${row.case_id}`);
  const args = [TSX, SHIM, "--request", join(RUN, row.input), "--policy", join(RUN, row.policy), "--phase", "dev",
    "--case-id", row.case_id, "--runlist", join(HERE, "runlist.json"), "--mode", "live", "--records", RECORDS, "--ledger", LEDGER, "--repo", RUN];
  const started = new Date().toISOString();
  const r = spawnSync(process.execPath, args, { env, encoding: "utf8", cwd: RUN });
  const ended = new Date().toISOString();
  calls += 1;
  const base = `${LOGS}/live-${String(row.case_no).padStart(3, "0")}-${row.case_id}${tag}`;
  writeFileSync(`${base}.cmd`, `cwd ${RUN}\nnode ${args.join(" ")}\nstarted ${started}\nended ${ended}\nexit ${r.status}\n`);
  writeFileSync(`${base}.out`, r.stdout ?? "");
  writeFileSync(`${base}.err`, r.stderr ?? "");
  const recordPath = (r.stdout ?? "").split(/\r?\n/)[0]?.trim();
  let rec = null;
  if (recordPath && existsSync(recordPath)) rec = JSON.parse(readFileSync(recordPath, "utf8"));
  inTok += rec?.usage?.input_tokens ?? 0; outTok += rec?.usage?.output_tokens ?? 0;
  return { status: r.status, recordPath, outcome: rec?.outcome_class ?? null, http: httpStatus(rec?.note), note: rec?.note ?? "", verdict: rec?.decision?.verdict ?? null,
    usage: rec?.usage ?? null, bytes: Buffer.byteLength(JSON.stringify(rec?.request ?? {})) };
}

function kind(res) {
  if (res.outcome === "answered") return "answered";
  if (res.outcome === "auth" || res.http === 401 || res.http === 403) return "auth";
  if (res.http === 413) return "too-large";
  if (res.outcome === "rate-limited" || res.outcome === "overloaded") return "retry";
  if (res.outcome === "transport" && (res.http === null || res.http === 429 || res.http >= 500)) return "retry";
  return "final-failure";
}

import { readdirSync } from "node:fs";
const answeredAlready = (row) => readdirSync(RECORDS).filter((f) => f.startsWith(`cal2-${row.case_id}.G_done.`))
  .some((f) => JSON.parse(readFileSync(join(RECORDS, f), "utf8")).outcome_class === "answered");
for (const row of rows) {
  if (answeredAlready(row)) { console.log(`${row.case_id}: already answered; never re-ask; skipped`); continue; }
  let n = 1;
  let res = call(row, "");
  const line = (x, t) => `${row.case_id}${t}: exit ${x.status}, outcome ${x.outcome}, http ${x.http}, decision ${x.verdict}, usage ${JSON.stringify(x.usage)}${x.outcome === "answered" ? "" : `, note ${x.note.slice(0, 160)}`}`;
  console.log(line(res, ""));
  summary.push({ case_id: row.case_id, case_no: row.case_no, attempt: n, kind: kind(res), ...res });
  while (kind(res) === "retry" && n <= MAX_RETRIES_PER_ROW) {
    retries += 1; n += 1;
    res = call(row, `-retry${n - 1}`);
    console.log(line(res, ` (retry ${n - 1} of ${MAX_RETRIES_PER_ROW})`));
    summary.push({ case_id: row.case_id, case_no: row.case_no, attempt: n, kind: kind(res), ...res });
  }
  if (kind(res) === "auth") { stopReason = `auth on ${row.case_id}`; break; }
  if (res.outcome === null) { stopReason = `shadow-done exit ${res.status} with no record on ${row.case_id}`; break; }
}

console.log(`calls ${calls}; retries ${retries}; usage input_tokens ${inTok}, output_tokens ${outTok}; stop ${stopReason ?? "none: every dev row called"}`);
writeFileSync(`${LOGS}/run-live.summary.${from}-${to}.json`, JSON.stringify({ calls, retries, usage: { input_tokens: inTok, output_tokens: outTok }, stopReason, summary }, null, 2));
process.exit(stopReason ? 1 : 0);
