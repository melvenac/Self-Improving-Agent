import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const seven = ["trigger/hook", "pipelines/state-import-r2", "pipelines/sync/staleness", "cli-bootstrap", "pipelines/state-import-r4", "pipelines/session-start/derived-artifacts", "pipelines/state-import-staleness"];
const harness = ["harness/runtime", "harness/policies", "harness/refwatch-stage", "harness/cli"];
console.log("run | " + [...seven, ...harness].map((s) => s.split("/").pop()).join(" | "));
for (const run of process.argv.slice(2)) {
  const a = readdirSync(`art-${run}`)[0];
  const dir = join(`art-${run}`, a, "eld");
  const rows = readdirSync(dir).flatMap((f) => readFileSync(join(dir, f), "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)));
  const get = (s) => { const r = rows.find((x) => x.file.endsWith(`tests/${s}.test.ts`)); return r ? (r.gapMaxMs / 1000).toFixed(1) : "-"; };
  console.log(`${run} | ` + [...seven, ...harness].map(get).join(" | "));
}
