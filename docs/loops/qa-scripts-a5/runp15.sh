#!/bin/bash
# QA 92: every CA-15 loop probe against A5, A4, A3 archive copies. Exit codes captured per command, unpiped.
S="$TEMP/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad/qa"
TSX=/c/Users/melve/Worktrees/sia-qa/open-brain/node_modules/tsx/dist/cli.mjs
P="base baseCtl a1 a2 a3 a4 a4pre a5 a6config a6hook r35base machineNext machineHard machineHardAbsent r35chainJ r35chainH baseHard baseDotGitRepo baseDotGitVictim newHook baseHardCfg baseHardEdit r54Twice r54Revert machineReplace plannerPlant r35anchor hooksReplacedHard ca4fBase r35edit r35anchorEdit"
cd "$S"
for t in "$@"; do
  t0=$(date -u +%T)
  node "$TSX" probe15-a5.mts "$(cd arch/$t/open-brain && pwd -W)" $P > "p15-$t.json" 2> "p15-$t.err"
  echo "$t exit=$? $t0->$(date -u +%T) stderr_bytes=$(wc -c < p15-$t.err)"
done
