// QA 237 targeted probes: spellings in classes the r5 property tests do not generate. Real built CLI, fixture stdin.
// Usage: node probe-holes.mjs [out.json]   (QA237_BUILD selects the build)
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, bash, pwsh, write, FX } from "./lib.mjs";

const fx = makeFixture();
const ob = `${fx}/open-brain`;
const NL = "\n";
// expect: what the property requires. "deny" for a literal write landing under a protected path or a merge/push
// outside the no-grant grammar; "allow" for a write landing outside with no cd, or a non-merge command.
const rows = [
  // ---- P1: shell keywords and runner commands put the writer out of command position ----
  ["P1 keyword `then`", bash(`if true; then cp a.ts open-brain/src/x.ts; fi`), "deny"],
  ["P1 keyword `do`", bash(`for f in a; do cp a.ts open-brain/src/x.ts; done`), "deny"],
  ["P1 keyword `!`", bash(`! cp a.ts open-brain/src/x.ts`), "deny"],
  ["P1 brace group `{ tee ...; }`", bash(`{ echo x | tee open-brain/src/x.ts; }`), "deny"],
  ["P1 runner `timeout 5 cp`", bash(`timeout 5 cp a.ts open-brain/src/x.ts`), "deny"],
  ["P1 runner `find -exec cp`", bash(`find . -name a.ts -exec cp {} open-brain/src/x.ts \\;`), "deny"],
  ["P1 control `cp` plain", bash(`cp a.ts open-brain/src/x.ts`), "deny"],
  // ---- P1: GNU option spellings ----
  ["P1 cp attached -tDIR", bash(`cp -topen-brain/src a.ts`), "deny"],
  ["P1 cp cluster -vt DIR", bash(`cp -vt open-brain/src a.ts`), "deny"],
  ["P1 cp long-option prefix --target DIR", bash(`cp --target open-brain/src a.ts`), "deny"],
  ["P1 tee long --append", bash(`echo x | tee --append open-brain/src/x.ts`), "deny"],
  // ---- P1: line continuation, comments, heredoc ----
  ["P1 backslash-newline inside target", bash(`echo x > open-brain/sr\\${NL}c/cli.ts`), "deny"],
  ["P1 backslash-newline between words", bash(`cp a.ts \\${NL}open-brain/src/x.ts`), "deny"],
  ["P1 comment opens a fake heredoc", bash(`echo hi # <<EOF${NL}cp a.ts open-brain/src/x.ts${NL}EOF`), "deny"],
  ["P1 heredoc fed to bash", bash(`bash <<'EOF'${NL}echo x > open-brain/src/x.ts${NL}EOF`), "deny"],
  ["P1 code piped to sh", bash(`echo 'echo x > open-brain/src/x.ts' | sh`), "deny"],
  ["P1 `bash -c` control", bash(`bash -c 'echo x > open-brain/src/x.ts'`), "deny"],
  ["P1 sed w command (no -i)", bash(`sed -n 'w open-brain/src/x.ts' a.txt`), "deny"],
  // ---- P1 "only if" half: outside writes, no cd ----
  ["P1-only-if outside quoted space", bash(`echo x > "C:/qa-tmp/a b.txt"`), "allow"],
  ["P1-only-if outside UNC", bash(`echo x > //server/share/open-brain/src/x.ts`), "allow"],
  ["P1-only-if comment after write outside", bash(`echo x > C:/qa-tmp/o.txt # (note)`), "allow"],
  ["P1-only-if commented-out write", bash(`echo x # > open-brain/src/x.ts`), "allow"],
  ["P1-only-if fd dup 2>&1 outside", bash(`npm test > C:/qa-tmp/o.txt 2>&1`), "allow"],
  // ---- P2: gh ----
  ["P2 comment eats the PR number `gh pr merge #2`", bash(`gh pr merge #2`), "deny-grammar"],
  ["P2 other-repo pull URL", bash(`gh pr merge https://github.com/evil/x/pull/1`), "deny-grammar"],
  ["P2 exact control `gh pr merge 1 --squash`", bash(`gh pr merge 1 --squash`), "deny-token"],
  ["P2 origin URL control", bash(`gh pr merge https://github.com/melvenac/Self-Improving-Agent/pull/1`), "deny-token"],
  ["P2 non-merge `gh pr comment 5 --body merge`", bash(`gh pr comment 5 --body merge`), "allow"],
  ["P2 non-merge `gh pr list --label merge`", bash(`gh pr list --label merge`), "allow"],
  ["P2 non-merge `gh pr create --title merge`", bash(`gh pr create --title merge`), "allow"],
  ["P2 non-merge `gh pr view 5`", bash(`gh pr view 5`), "allow"],
  ["P2 gh alias defined inline then used", bash(`gh alias set mm 'pr merge' && gh mm 2`), "deny"],
  ["P2 PS `& gh pr merge 1`", pwsh(`& gh pr merge 1`), "deny"],
  ["P2 PS `.\\gh.exe pr merge 1`", pwsh(`.\\gh.exe pr merge 1`), "deny"],
  // ---- P2b: git ----
  ["P2b inline alias force push", bash(`git -c alias.fp='push --force origin master' fp`), "deny"],
  ["P2b inline alias merge", bash(`git -c alias.m=merge m feature`), "deny"],
  ["P2b standing control", bash(`git push origin loop/x`), "allow"],
  ["P2b git merge-base not merge", bash(`git merge-base a b`), "allow"],
  ["P2b push with --no-verify standing", bash(`git push --no-verify origin loop/x`), "allow"],
  ["P2b push -u standing", bash(`git push -u origin qa/x`), "allow"],
  ["P2b push --force-if-includes", bash(`git push --force-if-includes origin loop/x`), "deny"],
  ["P2b push in for loop", bash(`for b in x; do git push --force origin master; done`), "deny"],
  // ---- P3: PowerShell ----
  ["P3 New-Item -Type File (alias)", pwsh(`New-Item -Type File open-brain/src/x.ts`), "deny"],
  ["P3 New-Item -ItemType File control", pwsh(`New-Item -ItemType File open-brain/src/x.ts`), "deny"],
  ["P3 Set-Content -EA (common-param alias)", pwsh(`Set-Content -EA SilentlyContinue open-brain/src/x.ts x`), "deny"],
  ["P3 Set-Content -OutVariable", pwsh(`Set-Content -OutVariable o open-brain/src/x.ts x`), "deny"],
  ["P3 Copy-Item -EA 0", pwsh(`Copy-Item -EA 0 a.ts open-brain/src/x.ts`), "deny"],
  // Re-run correction: Windows PowerShell 5.1 has no -LP alias, so this writes nothing (shell-truth.mjs): allow is right.
  ["P3 Set-Content -LP after a positional", pwsh(`Set-Content x -LP open-brain/src/x.ts`), "allow"],
  ["P3 Set-Content -Path (Join-Path ...)", pwsh(`Set-Content -Path (Join-Path open-brain src/x.ts) -Value x`), "deny"],
  ["P3 splat array", pwsh(`$a = 'open-brain/src/x.ts','x'; Set-Content @a`), "deny"],
  ["P3 splat hashtable via New-Object", pwsh(`$h = New-Object Hashtable; $h.Path = 'open-brain/src/x.ts'; $h.Value = 'x'; Set-Content @h`), "deny"],
  ["P3 block comment hides cmdlet `<##>`", pwsh(`<##> Set-Content open-brain/src/x.ts x`), "deny"],
  ["P3 [scriptblock]::Create", pwsh(`[scriptblock]::Create('Set-Content open-brain/src/x.ts x').Invoke()`), "deny"],
  ["P3 powershell positional command", pwsh(`powershell Set-Content open-brain/src/x.ts x`), "deny"],
  ["P3 powershell -EncodedCommand", pwsh(`powershell -EncodedCommand UwBlAHQALQBDAG8AbgB0AGUAbgB0ACAAbwBwAGUAbgAtAGIAcgBhAGkAbgAvAHMAcgBjAC8AeAAuAHQAcwAgAHgA`), "deny"],
  ["P3 [IO.File]::WriteAllText", pwsh(`[IO.File]::WriteAllText('open-brain/src/x.ts', 'x')`), "deny"],
  ["P3 Out-File control", pwsh(`'x' | Out-File open-brain/src/x.ts`), "deny"],
  ["P3 Set-Content -Path: control", pwsh(`Set-Content -Path:open-brain/src/x.ts -Value x`), "deny"],
  ["P3 PS `rm` alias (limit text calls rm out of reach)", pwsh(`rm open-brain/src/x.ts`), "deny"],
  ["P3 only-if: Set-Content outside", pwsh(`Set-Content C:/qa-tmp/x.txt x`), "allow"],
  ["P3 only-if: New-Item -Type File outside", pwsh(`New-Item -Type File C:/qa-tmp/x.txt`), "allow"],
  ["P3 cwd=open-brain Set-Content src/x.ts", pwsh(`Set-Content src/x.ts x`, ob), "deny"],
  // ---- nesting depth (limit text) ----
  ["LIMIT nesting depth 5 bash -c", bash(`bash -c "bash -c 'bash -c \\"bash -c \\\\\\"bash -c \\\\\\\\\\\\\\"echo x > open-brain/src/x.ts\\\\\\\\\\\\\\"\\\\\\"\\"'"`), "deny"],
  ["LIMIT Rename-Item second argument", pwsh(`Rename-Item C:/qa-tmp/a.txt x.ts`), "allow"],
];

const res = await runAll(rows.map(([id, payload, expect]) => ({ id, payload, expect })));
const cls = (r) => {
  if (r.decision === "allow") return "allow";
  if (/no GitHub token/.test(r.reason)) return "deny-token";
  if (/outside the one no-grant grammar|not a single gh pr merge|--repo\/-R|could not parse/.test(r.reason)) return "deny-grammar";
  return "deny";
};
const out = {};
for (const r of res) {
  const got = cls(r);
  const pass = r.expect === got || (r.expect === "deny" && got.startsWith("deny"));
  out[r.id] = { expect: r.expect, got, pass, reason: r.reason.slice(0, 400) };
  console.log(`${pass ? "ok  " : "MISS"} ${r.id} -> ${got}${pass ? "" : `  | ${r.reason.slice(0, 160)}`}`);
}
console.log(`${res.filter((r) => out[r.id].pass).length}/${res.length} as the property requires`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
