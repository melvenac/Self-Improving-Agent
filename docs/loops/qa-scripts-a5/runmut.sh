#!/bin/bash
# QA session 87: run each A3 mutant against the six candidate row files (JSON reporter) and its CA-15 probes.
# Exit codes are captured unpiped, per command.
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad/qa
SW=$(cd $S && pwd -W)
TSX=/c/Users/melve/Worktrees/sia-qa/open-brain/node_modules/tsx/dist/cli.mjs
FILES="tests/harness/config-channel.test.ts tests/harness/configwatch-links.test.ts tests/harness/process-role.test.ts tests/harness/spawn-sites.test.ts tests/harness/refwatch-stage.test.ts tests/harness/runtime.test.ts"
declare -A PROBES=(
  [M-L2-norestore]="a1 a3 a5 a6config"
  [M-follow-a]="a1 a2 a3 a4pre"
  [M-follow-b]="a5"
  [M-follow-c]="a6config a6hook baseHardEdit"
  [M-R44]="machineNext machineHard"
  [M-R45]="a4"
  [M-R45-record]="a4"
  [M-R45-mkdir]="a4"
  [M-R46-root]="a1 a2 a4pre"
  [M-R46-basenotes]="r35base"
  [M-R43-repo]="a6config a6hook hooksReplacedHard"
  [M-R49-repo]="newHook a6config"
  [M-R49-machine]="machineHardAbsent r35chainJ r35chainH machineHard machineNext r35anchor machineReplace"
  [M-R49-both]="newHook machineHardAbsent r35chainJ"
  [M-R49-repo+M-R43-repo]="a6config a6hook hooksReplacedHard"
  [M-R54]="r54Twice plannerPlant ca4fBase"
  [M-R50]="baseHard baseHardCfg"
  [M-R50+agrees-v2]="baseHard baseHardCfg"
  [M-R55-route]="r35edit r35anchorEdit r35chainJ r35chainH"
  [M-R55-realpath]="r35edit r35anchorEdit ca4fBase"
  [M-R59-read]="r54Revert"
)
for m in "$@"; do
  ob="$S/mut/$m/open-brain"
  cd "$ob" || { echo "$m: no tree"; continue; }
  t0=$(date -u +%T)
  node node_modules/vitest/vitest.mjs run $FILES --reporter=json --outputFile="$SW/mut/$m.rows.json" > "$S/mut/$m.rows.out" 2>&1
  rc=$?
  echo "$m rows_exit=$rc $t0->$(date -u +%T)"
  if [ -n "${PROBES[$m]}" ]; then
    node $TSX "$SW/probe15-a5.mts" "$(pwd -W)" ${PROBES[$m]} > "$S/mut/$m.p15.json" 2> "$S/mut/$m.p15.err"
    echo "$m probes_exit=$? $(date -u +%T)"
  fi
  if [ "$m" = "M-L0" ]; then
    node $TSX "$SW/probe2.mts" "$(pwd -W)" H > "$S/mut/$m.p2.json" 2> "$S/mut/$m.p2.err"
    echo "$m probe2_exit=$? $(date -u +%T)"
  fi
done
echo DONE
