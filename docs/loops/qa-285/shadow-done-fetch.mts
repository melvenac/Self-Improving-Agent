// QA 285 shim. The frozen tree's CLI (`harness shadow-done --request …`, cli.ts:468) calls runShadowDoneFrozen
// without a fetchImpl, and FrozenWireTransport (cal2-frozen.ts:159) has no default, so `--mode live` never sends
// ("no fetch implementation for live frozen request"). This shim is cmdShadowDone's frozen branch (cli.ts:446-489),
// the same flags, the same option object, PLUS `fetchImpl: globalThis.fetch` — the default JevTransport already
// uses (gate.ts:569). It imports the product function from the frozen run tree and edits no file in it.
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const RUN = "C:/qa-scratch/qa285-run";
const mod = await import(pathToFileURL(join(RUN, "open-brain/src/harness/cal2-frozen.ts")).href);
const sg = await import(pathToFileURL(join(RUN, "open-brain/src/harness/shadow-gates.ts")).href);
const gr = await import(pathToFileURL(join(RUN, "open-brain/src/harness/gate-records.ts")).href);

const argv = process.argv.slice(2);
const flags = new Map<string, string>();
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i]!.startsWith("--") || argv[i + 1] === undefined) { process.stderr.write(`bad args at ${argv[i]}\n`); process.exit(2); }
  flags.set(argv[i]!.slice(2), argv[i + 1]!);
}
const allowed = new Set(["request", "policy", "phase", "case-id", "runlist", "mode", "records", "ledger", "repo"]);
for (const k of flags.keys()) if (!allowed.has(k)) { process.stderr.write(`unrecognised flag --${k}\n`); process.exit(2); }
const repo = resolve(flags.get("repo") ?? process.cwd());
const phase = flags.get("phase");
if (phase !== "dev") { process.stderr.write(`QA 285 shim runs --phase dev only, got ${phase}\n`); process.exit(2); }
const mode = flags.get("mode") ?? "dry-run";
const ledger = mode === "live" ? resolve(flags.get("ledger") ?? join(repo, gr.SLICE_RECORDS_DIR, gr.SLICE_LEDGER_FILE)) : undefined;
// The record keeps only "HTTP <status>" for a refused call (FrozenWireTransport drops the body). For the
// report, a non-2xx response body is copied, with the key redacted, to C:/qa-tmp/qa285/http-bodies. The
// request is passed through untouched: same URL, same init, same bytes.
import { mkdirSync, writeFileSync } from "node:fs";
const loggingFetch: typeof fetch = async (url, init) => {
  const res = await globalThis.fetch(url, init);
  if (!res.ok) {
    const text = await res.clone().text().catch(() => "");
    const k = process.env.TYPESAFE_API_KEY ?? "";
    const safe = k ? text.split(k).join("[REDACTED]") : text;
    mkdirSync("C:/qa-tmp/qa285/http-bodies", { recursive: true });
    writeFileSync(`C:/qa-tmp/qa285/http-bodies/${flags.get("case-id")}.${Date.now()}.txt`, `HTTP ${res.status}\n${safe.slice(0, 4000)}\n`);
  }
  return res;
};
try {
  const result = await mod.runShadowDoneFrozen({
    repoRoot: repo,
    inputPath: resolve(flags.get("request")!),
    policyPath: resolve(flags.get("policy")!),
    phase,
    phaseDeclared: true,
    caseId: flags.get("case-id"),
    runlistPath: flags.has("runlist") ? resolve(flags.get("runlist")!) : undefined,
    mode,
    recordsDir: flags.has("records") ? resolve(flags.get("records")!) : undefined,
    ledgerPath: ledger,
    fetchImpl: loggingFetch,
  });
  process.stdout.write(`${result.recordPath}\n`);
  process.stdout.write(`decision: ${result.decision?.verdict ?? "none"} (shadow: recorded only)\n`);
  process.exit(result.exitCode);
} catch (err) {
  if (err instanceof sg.ShadowRunError) { process.stderr.write(`${(err as Error).message}\n`); process.exit((err as { exitCode: number }).exitCode); }
  throw err;
}
