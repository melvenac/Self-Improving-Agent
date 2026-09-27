#!/bin/bash
# QA 130 (QA 108 cidev10.sh, repointed): re-read each CI run the A11 handoff cites (and the candidate branch's own run): head sha, runner, totals,
# and the red tests by name (CA-9 abbreviated). Logs are fetched once by cilog11.sh into ci/.
for r in "$@"; do
  out=$(bash /c/qa-scratch/qa130/cilog11.sh "$r" 2>&1)
  sha=$(echo "$out" | head -1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);console.log(o.headSha.slice(0,7)+" "+o.headBranch.replace("loop/15-slice-3-","")+" "+o.conclusion)}catch{console.log("?")}})')
  runner=$(echo "$out" | grep -o "Runner name: '[^']*'" | head -1 | sed "s/Runner name: //")
  tot=$(echo "$out" | grep -E "^ *Tests  " | head -1 | sed 's/^ *//')
  step=$(grep -aE "error TS|##\[error\]" /c/qa-scratch/qa130/ci/$r.txt | sed 's/^.*Z //' | head -2 | cut -c1-120 | tr '\n' ' ')
  echo "$r $sha $runner | $tot | $step"
  echo "$out" | sed -n '/^-- failed:/,/^-- matching/p' | grep -aE ' × ' | sed -E 's/^ × tests\/harness\///; s/ [0-9]+ms$//' | sed -E 's/process-role.test.ts > .*CA-9.*/CA-9/' | awk '{print "     x " substr($0,1,170)}'
done
