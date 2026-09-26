// QA 129: re-read each run's B-8 record from its job log and artifact. Log lines are anchored on the content that
// follows the timestamp, so the log's echo of the PowerShell source cannot match (QA 123, E-2).
// Usage: node b8.mjs <run> [<run> ...]   (log-<run>.txt and art-<run>/ in this directory)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const anchors = [
  /^Runner name: /, /^Machine name: /,
  /^BASELINE cpu_load_pct=/, /^BASELINE_QUIET$/, /BASELINE_NOT_QUIET/, /^TOP5 /, /^> vitest run/, /^PARAMS cpu=/,
  /^SUITE_EXIT=/, /^ON_TASK_UPDATE_TIMEOUTS=/, /^\s*Test Files /, /^\s*Tests /, /^\s*Errors /, /^\s*Duration /,
  /^ELD rows=/, /^ELD gap=/, /Timeout calling "onTaskUpdate"/, /exit code 9[01]/,
];

for (const run of process.argv.slice(2)) {
  const log = readFileSync(`log-${run}.txt`, "utf8").split(/\r?\n/);
  const out = [];
  for (const raw of log) {
    const parts = raw.split("\t");
    if (parts.length < 3) continue;
    const [job, step] = parts;
    if (job !== "test-windows") continue;
    const rest = parts.slice(2).join("\t");
    const m = rest.match(/^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z (.*)$/);
    if (!m) continue;
    const content = m[1].replace(/(\x1b|\^\[)\[[0-9;]*m/g, "");
    if (anchors.some((a) => a.test(content))) out.push(content.trimEnd());
  }
  console.log(`===== ${run}`);
  for (const l of out) console.log(l);

  const artRoot = `art-${run}`;
  if (!existsSync(artRoot)) { console.log("NO ARTIFACT DIR"); continue; }
  const arts = readdirSync(artRoot);
  console.log(`artifact dirs: ${arts.join(",")}`);
  const eldDir = join(artRoot, arts[0], "eld");
  const rows = [];
  for (const f of readdirSync(eldDir)) {
    for (const line of readFileSync(join(eldDir, f), "utf8").split(/\r?\n/)) {
      if (line.trim()) rows.push(JSON.parse(line));
    }
  }
  const base = (p) => p.replace(/^.*\/open-brain\//, "");
  const files = new Set(rows.map((r) => r.file));
  rows.sort((a, b) => b.gapMaxMs - a.gapMaxMs);
  const over30 = rows.filter((r) => r.gapMaxMs >= 30000 || r.eldMaxMs >= 30000);
  const over60 = rows.filter((r) => r.gapMaxMs >= 60000 || r.eldMaxMs >= 60000);
  const maxGap = Math.max(...rows.map((r) => r.gapMaxMs));
  const maxEld = Math.max(...rows.map((r) => r.eldMaxMs));
  const worstEld = rows.slice().sort((a, b) => b.eldMaxMs - a.eldMaxMs)[0];
  console.log(`ARTIFACT ELD: rows=${rows.length} distinctFiles=${files.size} maxGap=${maxGap} maxEld=${maxEld} (eld worst ${base(worstEld.file)})`);
  console.log(`  >=30s: ${over30.map((r) => `${base(r.file)} gap=${r.gapMaxMs} eld=${r.eldMaxMs}`).join("; ") || "none"}`);
  console.log(`  >=60s: ${over60.length}`);
  console.log(`  top5: ${rows.slice(0, 5).map((r) => `${base(r.file)} ${r.gapMaxMs}/${r.eldMaxMs} wall=${r.wallMs}`).join("; ")}`);
  const lg = JSON.parse(readFileSync(join(artRoot, arts[0], "loadgen.json"), "utf8"));
  console.log(`  loadgen: params=${JSON.stringify(lg.params)} children=${lg.children.length} dead=${lg.deadBeforeStop.length} neverBeat=${lg.neverBeat.length} alive=${lg.alive.length} leaked=${lg.leaked.length} exit=${lg.commandExit} capped=${lg.cappedByDuration} cmd="${lg.command}"`);
}
