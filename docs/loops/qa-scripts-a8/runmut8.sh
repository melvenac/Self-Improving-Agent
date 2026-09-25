#!/bin/bash
# QA 99: each A8 mutant (mut8/<name>, or arch/A8 for the unmutated BASELINE) against the row files, the candidate's
# seam test, the carried probe files and this seat's (JSON reporter); then its CA-15 loop probes. Exit codes unpiped.
# Run nothing beside this.
S=/c/qa99
TSX=/c/qa99/arch/A8/open-brain/node_modules/tsx/dist/cli.mjs
FILES="tests/harness/config-channel.test.ts tests/harness/configwatch-links.test.ts tests/harness/configwatch-a7-seam.test.ts tests/harness/process-role.test.ts tests/harness/spawn-sites.test.ts tests/harness/refwatch-stage.test.ts tests/harness/runtime.test.ts tests/harness/qa94-handle.test.ts tests/harness/qa96-seam.test.ts tests/harness/qa99-seam.test.ts tests/harness/qa99-a8-probe.test.ts tests/harness/qa96-a7-probe.test.ts tests/harness/qa94-a6-probe.test.ts tests/harness/qa96-b2.test.ts"
declare -A PROBES=(
  [M-L2-norestore]="a1 a3 a5 a6config"
  [M-follow-a7]="a1 a2 a3 a4pre"
  [M-R46-basenotes6]="r35base"
  [M-R43-repo]="a6config a6hook hooksReplacedHard"
  [M-R49-repo]="newHook a6config"
  [M-R54-7]="r54Twice plannerPlant ca4fBase"
  [M-R50]="baseHard baseHardCfg baseHardEdit"
  [M-dev7-r50]="baseHard baseHardCfg baseHardEdit"
  [M-R59-read8]="r54Revert"
  [M-dev-object]="machineHardAbsent r35chainJ r35chainH machineHard machineNext r35anchor machineReplace"
  [M-dev-handle]="r35edit r35anchorEdit ca4fBase"
  [M-handle-narrow]="machineHard r35chainJ r35edit r35anchorEdit ca4fBase"
  [M-typechange6]="machineNext r35anchor"
  [M-R29-both]="machineNext machineHard machineReplace r35chainJ r35chainH"
  [M-R67-realpath8]="machineNext machineHard machineReplace r35chainJ r35chainH r35anchor"
  [M-R67-nlink]="machineHard machineReplace r35chainJ r35chainH"
  [M-dev8-r67]="machineReplace r54Twice r54Revert ca4fBase"
  [M-R69-nlink]="machineHardAbsent machineHard"
  [M-R69-parent]="machineHardAbsent r35chainJ"
)
for m in "$@"; do
  if [ "$m" = "BASELINE" ]; then ob="$S/arch/A8/open-brain"; else ob="$S/mut8/$m/open-brain"; fi
  cd "$ob" || { echo "$m: no tree"; continue; }
  for f in qa94-a6-probe qa94-handle qa96-a7-probe qa96-seam qa96-b2 qa99-a8-probe qa99-seam; do cp "$S/$f.test.ts" tests/harness/ || echo "$m: copy $f failed"; done
  t0=$(date -u +%T)
  node node_modules/vitest/vitest.mjs run $FILES --reporter=json --outputFile="C:/qa99/mut8/$m.rows.json" > "$S/mut8/$m.rows.out" 2>&1
  rc=$?
  echo "$m rows_exit=$rc $t0->$(date -u +%T)"
  if [ -n "${PROBES[$m]}" ]; then
    node $TSX "C:/qa99/probe15-a5.mts" "$(pwd -W)" ${PROBES[$m]} > "$S/mut8/$m.p15.json" 2> "$S/mut8/$m.p15.err"
    echo "$m probes_exit=$? $(date -u +%T)"
  fi
  if [ "$m" = "M-L0" ]; then
    node $TSX "C:/qa99/probe2.mts" "$(pwd -W)" H > "$S/mut8/$m.p2.json" 2> "$S/mut8/$m.p2.err"
    echo "$m probe2_exit=$? $(date -u +%T)"
  fi
done
echo DONE
