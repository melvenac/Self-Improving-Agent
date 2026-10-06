// QA 287: one live `harness shadow-done --mode live --phase dev` call per DEV runlist row, through the built
// CLI as shipped (no shim, no fetch injection). Run from the run tree root, in the foreground.
//   node docs/loops/qa-287/run-live.mjs <from> <to>     (row index range over runlist.phases.dev, to exclusive)
// - The key is read from HKCU\Environment into this process only and passed to the child in its env.
//   Only its fingerprint (first 10 hex of sha256, uppercased) is ever compared; the key is never printed.
// - Never re-asks: a row that already has a record with a non-retryable outcome is skipped. Retries only on
//   transport, rate-limited or overloaded, at most 3 retries per row. `auth` stops everything (exit 3).
//   `unavailable` on a live call means the CLI did not send (F1 not fixed): stop everything (exit 4).
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [from, to] = process.argv.slice(2).map((n) => Number.parseInt(n, 10));
const RUNLIST = "docs/loops/jev-calibration-2/runlist.json";
const RECORDS = "docs/loops/jev-calibration-2/records-dev-r2";
const LEDGER = `${RECORDS}/attempts.jsonl`;
const LOGS = "C:/qa-tmp/qa287/live-logs";
mkdirSync(RECORDS, { recursive: true });
mkdirSync(LOGS, { recursive: true });

const regOut = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "TYPESAFE_API_KEY"], { encoding: "utf8" });
const m = /TYPESAFE_API_KEY\s+REG_(?:EXPAND_)?SZ\s+(\S+)/.exec(regOut);
if (!m) { console.error("key: not found in HKCU\\Environment"); process.exit(5); }
const KEY = m[1];
const fp = createHash("sha256").update(KEY).digest("hex").slice(0, 10).toUpperCase();
if (fp !== "728B667EFF") { console.error(`key: fingerprint mismatch (${fp})`); process.exit(5); }
console.log(`key: loaded from HKCU\\Environment; fingerprint ${fp} matches 728B667EFF`);

const rl = JSON.parse(readFileSync(RUNLIST, "utf8"));
const held = new Set(JSON.parse(readFileSync("docs/loops/jev-calibration-2-split.json", "utf8")).held_out.case_ids);
const RETRYABLE = new Set(["transport", "rate-limited", "overloaded"]);
const env = { ...process.env, TYPESAFE_API_KEY: KEY };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function recordsFor(row) {
  return readdirSync(RECORDS)
    .filter((f) => f.startsWith(`cal2-${row.case_id}.G_done.`) && f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, rec: JSON.parse(readFileSync(join(RECORDS, f), "utf8")) }))
    .filter(({ rec }) => rec.dt?.path === row.input);
}

const summary = [];
let stop = 0;
for (let i = from; i < to && i < rl.phases.dev.length && !stop; i++) {
  const row = rl.phases.dev[i];
  if (row.phase !== "dev" || held.has(row.case_id)) throw new Error(`held-out guard tripped on ${row.case_id}`);
  let prior = recordsFor(row);
  if (prior.some(({ rec }) => !RETRYABLE.has(rec.outcome_class))) {
    summary.push({ i, case_id: row.case_id, skipped: "already has a non-retryable record", records: prior.map((p) => p.file) });
    console.log(`${i} ${row.case_id}: skipped (already settled)`);
    continue;
  }
  let retries = Math.max(0, prior.length - 1);
  for (;;) {
    if (prior.length > 0 && retries >= 3) break;
    if (prior.length > 0) { retries = prior.length; sleep([10_000, 30_000, 60_000][Math.min(retries - 1, 2)]); }
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [
      "open-brain/build/harness/cli.js", "shadow-done",
      "--request", row.input, "--policy", row.policy, "--phase", "dev",
      "--case-id", row.case_id, "--runlist", RUNLIST,
      "--mode", "live", "--records", RECORDS, "--ledger", LEDGER,
    ], { env, encoding: "utf8", timeout: 120_000 });
    const ms = Date.now() - t0;
    const tag = `${String(i).padStart(2, "0")}-${row.case_id}-a${prior.length + 1}`;
    writeFileSync(`${LOGS}/${tag}.stdout`, r.stdout ?? "");
    writeFileSync(`${LOGS}/${tag}.stderr`, r.stderr ?? "");
    const after = recordsFor(row);
    const fresh = after.filter((a) => !prior.some((p) => p.file === a.file));
    if (fresh.length !== 1) { console.error(`${row.case_id}: expected 1 new record, got ${fresh.length}; exit ${r.status}`); stop = 6; break; }
    const rec = fresh[0].rec;
    const entry = {
      i, case_id: row.case_id, label: row.label, attempt: rec.attempt, exit: r.status, ms,
      outcome_class: rec.outcome_class, sent: rec.sent, note: rec.note, model_resolved: rec.model_resolved,
      usage: rec.usage, verdict: rec.decision?.verdict ?? null, record: fresh[0].file,
    };
    summary.push(entry);
    console.log(`${i} ${row.case_id} [${row.label}] a${rec.attempt}: ${rec.outcome_class} exit ${r.status} ${ms}ms verdict ${entry.verdict} ${rec.outcome_class === "answered" ? "" : rec.note}`);
    prior = after;
    if (rec.outcome_class === "auth") { stop = 3; break; }
    if (rec.outcome_class === "unavailable") { stop = 4; break; }
    if (!RETRYABLE.has(rec.outcome_class)) break;
  }
}
writeFileSync(`docs/loops/qa-287/run-live.summary.${from}-${to}.json`, JSON.stringify(summary, null, 2) + "\n");
if (stop) console.error(`STOP: code ${stop}`);
process.exit(stop);
