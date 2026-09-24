#!/bin/bash
# QA 94: the remaining local runs, one at a time. Exit codes per command, unpiped.
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/08650273-2511-4f23-8fbc-6b4796c2a257/scratchpad/qa
TSX=/c/Users/melve/Worktrees/sia-qa/open-brain/node_modules/tsx/dist/cli.mjs
cd $S
for m in M-follow-a6 M-drifted-off; do
  node build6.mjs "$m" > "mut6/$m.build.txt" 2>&1; b=$?
  tscl=$(grep -o 'TSC_EXIT=[0-9]*' "mut6/$m.build.txt"); echo "$m build_exit=$b $tscl"
  if [ $b -eq 0 ] && [ "$tscl" = "TSC_EXIT=0" ]; then bash runmut6.sh "$m" | grep -v DONE; fi
done
# M-follow-a6's probes (runmut6.sh maps M-follow-a, not -a6)
node $TSX probe15-a5.mts "$(cd mut6/M-follow-a6/open-brain && pwd -W)" a1 a2 a3 a4pre > mut6/M-follow-a6.p15.json 2> mut6/M-follow-a6.p15.err; echo "M-follow-a6 probes_exit=$? $(date -u +%T)"
# M-drifted-off against R62's probe
node $TSX probe-r62.mts "$(cd mut6/M-drifted-off/open-brain && pwd -W)" > r62-M-drifted-off.json 2> r62-M-drifted-off.err; echo "r62 drifted-off exit=$? $(date -u +%T)"
for t in A6 A5 A4; do
  T=$(cd arch/$t/open-brain && pwd -W)
  node $TSX probe2.mts "$T" H R34 SINGLE DFORK DMGconfig DMGhead DMGindex COMPOSE > p2-$t.json 2> p2-$t.err; echo "probe2 $t exit=$? $(date -u +%T)"
  node $TSX probe-r57.mts "$T" > r57-$t.json 2> r57-$t.err; echo "r57 $t exit=$? $(date -u +%T)"
  node $TSX probe-r59.mts "$T" > r59-$t.json 2> r59-$t.err; echo "r59 $t exit=$? $(date -u +%T)"
done
# GITCONFIG-LOOP on win32, against A6 (the probe file's other tests are POSIX-only and skip)
cp qa94-a6-probe.test.ts arch/A6/open-brain/tests/harness/
cd arch/A6/open-brain && node node_modules/vitest/vitest.mjs run tests/harness/qa94-a6-probe.test.ts > $S/gcl-A6-win32.out 2>&1; echo "gcl win32 exit=$? $(date -u +%T)"
echo RESTDONE
