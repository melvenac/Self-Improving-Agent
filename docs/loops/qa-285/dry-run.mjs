// QA 285 step 4: dry-run every DEV row; records go to C:/qa-tmp (never into the run tree's records dir).
// Then check, for every row, that the record's subject.blob is sha256 of the input file's `request` bytes,
// where those bytes are found independently (shortest substring after `"request": ` that JSON.parses
// to a value deep-equal to the parsed request) rather than by the runner's brace scanner.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
const RUN = "C:/qa-scratch/qa285-run";
const HERE = join(RUN, "docs/loops/jev-calibration-2");
const OUT = "C:/qa-tmp/qa285/dry-records";
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const rl = JSON.parse(readFileSync(join(HERE, "runlist.json"), "utf-8"));
const TSX = join(RUN, "open-brain/node_modules/tsx/dist/cli.mjs");
const CLI = join(RUN, "open-brain/src/harness/cli.ts");
const env = { ...process.env }; delete env.TYPESAFE_API_KEY;
let ok = 0, refused = [];
for (const row of rl.phases.dev) {
  const r = spawnSync(process.execPath, [TSX, CLI, "shadow-done", "--request", join(RUN, row.input), "--policy", join(RUN, row.policy),
    "--phase", "dev", "--case-id", row.case_id, "--runlist", join(HERE, "runlist.json"), "--mode", "dry-run", "--records", OUT, "--repo", RUN],
    { encoding: "utf-8", cwd: RUN, env });
  if (r.status === 0) ok++; else refused.push(`${row.case_id}: exit ${r.status} ${r.stderr.trim()}`);
}
console.log(`dry-run: ${rl.phases.dev.length} dev rows, ${ok} exit 0, ${refused.length} refused`);
refused.forEach((x) => console.log("  REFUSED " + x));
const recs = readdirSync(OUT).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(OUT, f), "utf-8")));
console.log(`dry-run records written: ${recs.length}; sent=true in any: ${recs.some((x) => x.sent)}; modes: ${[...new Set(recs.map((x) => x.mode))]}`);
function independentRequestBytes(text, req) {
  const m = /"request"\s*:\s*/.exec(text); const start = m.index + m[0].length;
  for (let j = text.indexOf("}", start); j !== -1; j = text.indexOf("}", j + 1)) {
    const s = text.slice(start, j + 1);
    try { const v = JSON.parse(s); if (isDeepStrictEqual(v, req)) return Buffer.from(s, "utf-8"); } catch {}
  }
  return null;
}
let bytesOk = 0; const bad = [];
for (const row of rl.phases.dev) {
  const text = readFileSync(join(RUN, row.input), "utf-8");
  const req = JSON.parse(text).request;
  const bytes = independentRequestBytes(text, req);
  const rec = recs.find((x) => x.dt?.path === row.input);
  const h = bytes && createHash("sha256").update(bytes).digest("hex");
  const good = rec && h === rec.subject.blob && isDeepStrictEqual(rec.request, req);
  if (good) bytesOk++; else bad.push(row.case_id);
  if (["first", "mid", "last"].some((_, k) => row === rl.phases.dev[[0, 16, 32][k]]))
    console.log(`spot ${row.case_id}: request bytes ${bytes?.length}, sha256 ${h}, record subject.blob ${rec?.subject.blob}, equal ${h === rec?.subject.blob}`);
}
console.log(`payload == input.request bytes (sha256) and parsed-equal: ${bytesOk}/${rl.phases.dev.length}; bad ${JSON.stringify(bad)}`);
process.exit(refused.length || bad.length ? 1 : 0);
