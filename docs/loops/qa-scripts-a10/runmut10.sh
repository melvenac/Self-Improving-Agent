#!/bin/bash
# QA 108 (QA 104's runmut9.sh, repointed to A10): each mutant (mut10/<name>, or arch/A10 for the unmutated BASELINE)
# against the candidate's config row files, the carried QA 89-104 probes and this seat's two files (JSON reporter).
# Exit codes unpiped. Run nothing beside this. Win32: POSIX-only rows skip here.
S=/c/qa-scratch/qa108
FILES="tests/harness/config-channel.test.ts tests/harness/configwatch-links.test.ts tests/harness/configwatch-a7-seam.test.ts tests/harness/configwatch-r77-contain.test.ts tests/harness/configwatch-r77-hardlink.test.ts tests/harness/configwatch-r78-read-facts.test.ts tests/harness/configwatch-r79-sides.test.ts tests/harness/configwatch-r80-report.test.ts tests/harness/configwatch-r80-texts.test.ts tests/harness/process-role.test.ts tests/harness/spawn-sites.test.ts tests/harness/refwatch-stage.test.ts tests/harness/runtime.test.ts tests/harness/qa104-a9-probe2.test.ts tests/harness/qa104-a9-probe3.test.ts tests/harness/qa89-a4-probe.test.ts tests/harness/qa92-a5-probe.test.ts tests/harness/qa94-a6-probe.test.ts tests/harness/qa94-handle.test.ts tests/harness/qa96-a7-probe.test.ts tests/harness/qa96-seam.test.ts tests/harness/qa96-b2.test.ts tests/harness/qa99-a8-probe.test.ts tests/harness/qa99-seam.test.ts tests/harness/qa104-a9-probe.test.ts tests/harness/qa104-seam.test.ts tests/harness/qa108-a10-probe.test.ts tests/harness/qa108-r61-copy.test.ts"
for m in "$@"; do
  if [ "$m" = "BASELINE" ]; then ob="$S/arch/A10/open-brain"; else ob="$S/mut10/$m/open-brain"; fi
  cd "$ob" || { echo "$m: no tree"; continue; }
  for f in qa89-a4-probe qa92-a5-probe qa94-a6-probe qa94-handle qa96-a7-probe qa96-seam qa96-b2 qa99-a8-probe qa99-seam qa104-a9-probe qa104-seam qa108-a10-probe qa108-r61-copy; do cp "$S/probes/$f.test.ts" tests/harness/ || echo "$m: copy $f failed"; done
  t0=$(date -u +%T)
  node node_modules/vitest/vitest.mjs run $FILES --reporter=json --outputFile="C:/qa-scratch/qa108/mut10/$m.rows.json" > "$S/mut10/$m.rows.out" 2>&1
  rc=$?
  echo "$m rows_exit=$rc $t0->$(date -u +%T) unhandled=$(grep -ac 'Unhandled' "$S/mut10/$m.rows.out")"
done
echo DONE
