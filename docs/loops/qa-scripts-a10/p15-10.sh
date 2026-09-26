#!/bin/bash
# QA 108 (QA 104's p15-9.sh, repointed): every CA-15 loop probe (QA 92's probe15-a5.mts, 31 probes), probe2, r57, r59
# and r62, on the A10 and A9 archive copies (win32). Exit codes captured per command, unpiped. Run nothing beside it.
TSX=/c/qa-scratch/qa108/wt-a10/open-brain/node_modules/tsx/dist/cli.mjs
L=C:/qa-scratch/qa108/lp
P="base baseCtl a1 a2 a3 a4 a4pre a5 a6config a6hook r35base machineNext machineHard machineHardAbsent r35chainJ r35chainH baseHard baseDotGitRepo baseDotGitVictim newHook baseHardCfg baseHardEdit r54Twice r54Revert machineReplace plannerPlant r35anchor hooksReplacedHard ca4fBase r35edit r35anchorEdit"
cd /c/qa-scratch/qa108/lp
for t in "$@"; do
  T=C:/qa-scratch/qa108/arch/$t/open-brain
  t0=$(date -u +%T)
  node $TSX $L/probe15-a5.mts "$T" $P > p15-$t.json 2> p15-$t.err; echo "p15 $t exit=$? $t0->$(date -u +%T) stderr_bytes=$(wc -c < p15-$t.err)"
  node $TSX $L/probe2.mts "$T" H R34 SINGLE DFORK DMGconfig DMGhead DMGindex COMPOSE > p2-$t.json 2> p2-$t.err; echo "probe2 $t exit=$? $(date -u +%T)"
  node $TSX $L/probe-r57.mts "$T" > r57-$t.json 2> r57-$t.err; echo "r57 $t exit=$? $(date -u +%T)"
  node $TSX $L/probe-r59.mts "$T" > r59-$t.json 2> r59-$t.err; echo "r59 $t exit=$? $(date -u +%T)"
  node $TSX $L/probe-r62.mts "$T" > r62-$t.json 2> r62-$t.err; echo "r62 $t exit=$? $(date -u +%T)"
done
