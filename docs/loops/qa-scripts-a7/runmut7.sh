#!/bin/bash
# QA 96: each A7 mutant (mut7/<name>, or arch/A7 for the unmutated baseline via BASELINE) against the row files +
# the candidate's seam test + qa94-handle + qa96-seam (JSON reporter), then its CA-15 probes. Exit codes unpiped.
# Run nothing beside this (QA 92 section 12).
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/07fe8094-75b7-499f-88b2-6bf1761d35a3/scratchpad/qa
SW=$(cd $S && pwd -W)
TSX=/c/Users/melve/Worktrees/sia-qa/open-brain/node_modules/tsx/dist/cli.mjs
FILES="tests/harness/config-channel.test.ts tests/harness/configwatch-links.test.ts tests/harness/configwatch-a7-seam.test.ts tests/harness/process-role.test.ts tests/harness/spawn-sites.test.ts tests/harness/refwatch-stage.test.ts tests/harness/runtime.test.ts tests/harness/qa94-handle.test.ts tests/harness/qa96-seam.test.ts"
declare -A PROBES=(
  [M-L2-norestore]="a1 a3 a5 a6config"
  [M-follow-a7]="a1 a2 a3 a4pre"
  [M-follow-b]="a5"
  [M-follow-c]="a6config a6hook baseHardEdit"
  [M-R44]="machineNext machineHard"
  [M-R45]="a4"
  [M-R45-record]="a4"
  [M-R45-mkdir]="a4"
  [M-R46-root]="a1 a2 a4pre"
  [M-R46-basenotes6]="r35base"
  [M-R43-repo]="a6config a6hook hooksReplacedHard"
  [M-R49-repo]="newHook a6config"
  [M-R49-repo+M-R43-repo]="a6config a6hook hooksReplacedHard"
  [M-R54-7]="r54Twice plannerPlant ca4fBase"
  [M-R50]="baseHard baseHardCfg baseHardEdit"
  [M-R50+agrees-v2]="baseHard baseHardCfg baseHardEdit"
  [M-dev7-r50]="baseHard baseHardCfg baseHardEdit"
  [M-R55-route]="r35edit r35anchorEdit r35chainJ r35chainH"
  [M-R59-read6]="r54Revert"
  [M-dev-object]="machineHardAbsent r35chainJ r35chainH machineHard machineNext r35anchor machineReplace"
  [M-dev-handle7]="r35edit r35anchorEdit ca4fBase"
  [M-handle-narrow7]="machineHard r35chainJ r35edit r35anchorEdit ca4fBase"
  [M-typechange6]="machineNext r35anchor"
  [M-dev7-type]="machineNext r35anchor"
  [M-R29-both]="machineNext machineHard machineReplace r35chainJ r35chainH"
  [M-R67-realpath]="machineNext machineHard machineReplace r35chainJ r35chainH r35anchor"
  [M-R67-nlink]="machineHard machineReplace r35chainJ r35chainH"
  [M-dev7-r67]="machineReplace r54Twice r54Revert ca4fBase"
)
for m in "$@"; do
  if [ "$m" = "BASELINE" ]; then ob="$S/arch/A7/open-brain"; else ob="$S/mut7/$m/open-brain"; fi
  cd "$ob" || { echo "$m: no tree"; continue; }
  cp "$S/qa94-handle.test.ts" "$S/qa96-seam.test.ts" tests/harness/ || { echo "$m: copy failed"; continue; }
  t0=$(date -u +%T)
  node node_modules/vitest/vitest.mjs run $FILES --reporter=json --outputFile="$SW/mut7/$m.rows.json" > "$S/mut7/$m.rows.out" 2>&1
  rc=$?
  echo "$m rows_exit=$rc $t0->$(date -u +%T)"
  if [ -n "${PROBES[$m]}" ]; then
    node $TSX "$SW/probe15-a5.mts" "$(pwd -W)" ${PROBES[$m]} > "$S/mut7/$m.p15.json" 2> "$S/mut7/$m.p15.err"
    echo "$m probes_exit=$? $(date -u +%T)"
  fi
  if [ "$m" = "M-L0" ]; then
    node $TSX "$SW/probe2.mts" "$(pwd -W)" H > "$S/mut7/$m.p2.json" 2> "$S/mut7/$m.p2.err"
    echo "$m probe2_exit=$? $(date -u +%T)"
  fi
done
echo DONE
