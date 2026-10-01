// Runs ONE batch of the remaining mutants: node run-batch.mjs <batch-file.json> <index>
// Refuses to start when free memory is under 1.5 GB (Clark's condition), runs run-mutants.mjs for that slice, and keeps the
// results as results-batch<index>.json. A batch is small on purpose: the first full run was stopped by the system for low memory.
import { spawnSync } from "node:child_process";
import { readFileSync, renameSync, existsSync } from "node:fs";
import { freemem } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [file, idx] = process.argv.slice(2);
const batches = JSON.parse(readFileSync(file, "utf8"));
const names = batches[Number(idx)];
if (!names) throw new Error(`no batch ${idx}`);
const gb = freemem() / 1024 ** 3;
console.log(`batch ${idx}: ${names.length} mutants, free memory ${gb.toFixed(2)} GB`);
if (gb < 1.5) {
  console.error("refusing: under 1.5 GB free");
  process.exit(3);
}
const r = spawnSync(process.execPath, [join(here, "run-mutants.mjs"), ...names], { cwd: join(here, "../../../../open-brain"), stdio: "inherit" });
const out = join(here, "results.json");
if (existsSync(out)) renameSync(out, join(here, `results-batch${idx}.json`));
process.exit(r.status ?? 1);
