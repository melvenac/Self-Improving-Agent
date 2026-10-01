// Runs the mutants in RAM-gated chunks, every id exactly once, one chunk after another, and records each chunk's exit code.
//   node run-chunks.mjs <first-chunk> <last-chunk> [chunk-size=12]    (from open-brain/)
// Before each chunk: wait until at least 1.5 GB is free and no OTHER vitest process is running (Clark: the QA PC is shared, and a single
// pass was killed for low memory). If the machine does not free up within 30 minutes the driver stops WITHOUT running that chunk and says so.
// Output: logs/chunk<N>.log per chunk, results-chunk<N>.json, and chunk-index.json (which chunk holds which ids).
import { spawnSync } from "node:child_process";
import { freemem } from "node:os";
import { existsSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [first, last, sizeArg] = process.argv.slice(2);
const size = Number(sizeArg ?? 12);
const { MUTANTS } = await import(pathToFileURL(join(here, "specs.mjs")).href);
const names = MUTANTS.map((m) => m.name);
const chunks = [];
for (let i = 0; i < names.length; i += size) chunks.push(names.slice(i, i + size));
writeFileSync(join(here, "chunk-index.json"), `${JSON.stringify(chunks, null, 1)}\n`);

const otherVitest = () => {
  const r = spawnSync("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'vitest' -and $_.CommandLine -notmatch 'Get-CimInstance' }).Count"], { encoding: "utf8" });
  return Number((r.stdout ?? "0").trim() || 0);
};
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (let c = Number(first); c <= Number(last) && c < chunks.length; c++) {
  let waited = 0;
  for (;;) {
    const gb = freemem() / 1024 ** 3;
    const others = otherVitest();
    if (gb >= 1.5 && others === 0) break;
    console.log(`chunk ${c}: waiting (free ${gb.toFixed(2)} GB, other vitest processes ${others})`);
    if (waited >= 30 * 60) {
      console.log(`chunk ${c}: NOT RUN, the machine did not free up in 30 minutes`);
      process.exit(4);
    }
    sleep(60_000);
    waited += 60;
  }
  const idx = JSON.stringify(chunks);
  writeFileSync(join(process.env.TEMP ?? ".", "r7-chunks.json"), idx);
  const r = spawnSync(process.execPath, [join(here, "run-batch.mjs"), join(process.env.TEMP ?? ".", "r7-chunks.json"), String(c)], { cwd: join(here, "../../../../open-brain"), stdio: "inherit" });
  const out = join(here, `results-batch${c}.json`);
  if (existsSync(out)) renameSync(out, join(here, `results-chunk${c}.json`));
  console.log(`chunk ${c} exit=${r.status}`);
}
