// QA 237: fail-closed cost. Commands a working planner would plausibly run that land OUTSIDE every protected path (or
// write nothing), through the real built CLI. Each refusal's text is recorded and classed by whether it names a stated
// cause (non-literal, cd, 8.3 short name). Usage: node fail-closed.mjs <out.json>
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, bash, pwsh, write, FX } from "./lib.mjs";

makeFixture();
const rows = [
  ["cd then redirect outside", bash(`cd docs && npm test > C:/qa-tmp/out.txt`)],
  ["cd then tee outside", bash(`cd open-brain && npx vitest run 2>&1 | tee C:/qa-tmp/vt.log`)],
  ["redirect to $TMPDIR", bash(`echo x > $TMPDIR/x`)],
  ["redirect to ~/notes", bash(`echo x > ~/notes.txt`)],
  ["redirect, target with ( )", bash(`echo x > "C:/qa-tmp/a (1).txt"`)],
  ["redirect, target with { }", bash(`echo x > "C:/qa-tmp/{a}.txt"`)],
  ["redirect, target with [ ]", bash(`echo x > "C:/qa-tmp/a[1].txt"`)],
  ["Program Files (x86) target", bash(`cp a.txt "C:/Program Files (x86)/x/a.txt"`)],
  ["8.3 short-name outside", bash(`echo x > C:/PROGRA~1/x.txt`)],
  ["trailing comment after an outside write", bash(`npm test 2>&1 | tee C:/qa-tmp/o.log # keep the log`)],
  ["commented-out write (writes nothing)", bash(`echo x # > open-brain/src/x.ts`)],
  ["unquoted backslashes (bash writes open-brainsrcx.ts in the root)", bash(`echo x > open-brain\\src\\x.ts`)],
  ["gh comment whose body is the word merge", bash(`gh pr comment 5 --body merge`)],
  ["gh pr list --label merge", bash(`gh pr list --label merge`)],
  ["standing push with a trailing comment", bash(`git push origin loop/x # push the slice`)],
  ["PS -LiteralPath with [ ]", pwsh(`Set-Content -LiteralPath 'C:/qa-tmp/a[1].txt' -Value x`)],
  ["PS ForEach-Object script block writing outside", pwsh(`1..2 | ForEach-Object { "x" | Out-File C:/qa-tmp/o$_.txt }`)],
  ["PS Set-Location then redirect outside", pwsh(`Set-Location docs; Get-ChildItem > C:/qa-tmp/ls.txt`)],
  ["PS $env:TEMP target", pwsh(`Set-Content $env:TEMP/x.txt x`)],
  ["Write tool, path with [ ]", write(`C:/qa-tmp/a[1].md`)],
  ["control: cd with no write", bash(`cd docs && ls`)],
  ["control: cd with output to /dev/null", bash(`cd docs && ls > /dev/null`)],
];
const res = await runAll(rows.map(([id, payload]) => ({ id, payload })));
const NAMED = /cannot be determined|shell expansion|glob|brace|starts with ~|parenthesis|changes directory|short name|cannot read statically|script block/;
const out = res.map((r) => ({ id: r.id, decision: r.decision, namedCause: r.decision === "deny" ? NAMED.test(r.reason) : null, reason: r.reason.split(" Static write detection only")[0].slice(0, 400) }));
for (const o of out) console.log(`${o.decision.padEnd(5)} ${o.namedCause === null ? "     " : o.namedCause ? "named" : "NONE "} ${o.id}\n      ${o.reason}`);
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
