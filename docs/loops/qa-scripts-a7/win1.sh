#!/bin/bash
# QA 96, window part 1: archives, the unmutated rows (with per-file durations), the win32 probe files and the win32
# loop probes, on A7 and A6. One command at a time; exit codes captured per command, unpiped.
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/07fe8094-75b7-499f-88b2-6bf1761d35a3/scratchpad/qa
SW=$(cd $S && pwd -W)
TSX=/c/Users/melve/Worktrees/sia-qa/open-brain/node_modules/tsx/dist/cli.mjs
cd $S
mkdir -p mut7 win
echo "start $(date -u +%T)"
node archive.mjs A7 d223d1dbe4247fdc0131cd92bfc14288c52d7cf5; echo "archive A7 exit=$?"
node archive.mjs A6 dc35b24869e77d2b62729d12598fb50e5adcd24b; echo "archive A6 exit=$?"
for t in A7 A6; do
  echo "$t configwatch blob $(git -C /c/Users/melve/Worktrees/sia-qa hash-object arch/$t/open-brain/src/harness/configwatch.ts)"
done
# 1. the unmutated rows at A7 (the baseline every mutant is read against)
bash runmut7.sh BASELINE | grep -v DONE
# 2. the win32 probe files on A7 and A6 (POSIX-only tests skip here and are read from CI)
PF="tests/harness/qa94-a6-probe.test.ts tests/harness/qa96-a7-probe.test.ts tests/harness/qa94-handle.test.ts tests/harness/qa96-seam.test.ts"
for t in A7 A6; do
  cd $S/arch/$t/open-brain
  cp $S/qa94-a6-probe.test.ts $S/qa96-a7-probe.test.ts $S/qa94-handle.test.ts $S/qa96-seam.test.ts tests/harness/
  t0=$(date -u +%T)
  node node_modules/vitest/vitest.mjs run $PF --reporter=json --outputFile="$SW/win/probes-$t.json" > "$S/win/probes-$t.out" 2>&1
  echo "probefiles $t exit=$? $t0->$(date -u +%T)"
  cd $S
done
# 3. the 31 loop probes, and probe2 / r57 / r59 / r62, on A7 and A6
bash runp15.sh A7 A6
for t in A7 A6; do
  T=$(cd arch/$t/open-brain && pwd -W)
  node $TSX probe2.mts "$T" H R34 SINGLE DFORK DMGconfig DMGhead DMGindex COMPOSE > win/p2-$t.json 2> win/p2-$t.err; echo "probe2 $t exit=$? $(date -u +%T)"
  node $TSX probe-r57.mts "$T" > win/r57-$t.json 2> win/r57-$t.err; echo "r57 $t exit=$? $(date -u +%T)"
  node $TSX probe-r59.mts "$T" > win/r59-$t.json 2> win/r59-$t.err; echo "r59 $t exit=$? $(date -u +%T)"
  node $TSX probe-r62.mts "$T" > win/r62-$t.json 2> win/r62-$t.err; echo "r62 $t exit=$? $(date -u +%T)"
done
echo "WIN1DONE $(date -u +%T)"
