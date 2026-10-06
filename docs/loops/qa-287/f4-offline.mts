// QA 287, F4 evidence OFFLINE: no live call returned non-2xx, so this drives runShadowDoneFrozen (as built) with an
// injected stub fetch and a DUMMY key (not the real one), for one dev input, and shows each record keeps the HTTP
// status and a bounded body. No network, no real key. Records and ledger go to C:/qa-tmp/qa287/f4.
import { readFileSync, mkdirSync } from "node:fs";
import { runShadowDoneFrozen } from "../../../open-brain/src/harness/cal2-frozen.ts";
const rl = JSON.parse(readFileSync("docs/loops/jev-calibration-2/runlist.json", "utf8"));
const row = rl.phases.dev.find((r: any) => r.case_id === "qa277-pr441");
const OUT = "C:/qa-tmp/qa287/f4";
mkdirSync(OUT, { recursive: true });
const big = "x".repeat(10_000);
const cases: [number, string][] = [
  [401, JSON.stringify({ detail: "bad key" })],
  [403, "forbidden"],
  [400, JSON.stringify({ detail: { error_type: "max_tokens_exceeded" } })],
  [429, "slow down"],
  [529, "overloaded"],
  [503, big],
  [418, "teapot"],
];
for (const [status, body] of cases) {
  const res = await runShadowDoneFrozen({
    repoRoot: ".", inputPath: row.input, policyPath: row.policy, phase: "dev", phaseDeclared: true,
    mode: "live", env: { TYPESAFE_API_KEY: "qa287-dummy-not-a-key" },
    fetchImpl: (async () => new Response(body, { status })) as typeof fetch,
    recordsDir: OUT, ledgerPath: `${OUT}/attempts-${status}.jsonl`,
  });
  const r: any = res.record;
  console.log(`HTTP ${status}: outcome_class ${r.outcome_class}; exit ${res.exitCode}; note "${r.note}"; response_detail ${r.response_detail === undefined ? "absent" : `${r.response_detail.length} chars`}${r.response_detail && r.response_detail.length < 80 ? ` "${r.response_detail}"` : ""}`);
}
