#!/bin/bash
# QA 130 (QA 108's runmut10.sh, repointed to A11): each mutant (mut11/<name>, or arch/<X> for BASELINE-<X>) against the
# candidate's config row files (A10's list + A11's r83-r88), the carried QA 89-104 probes, QA 108's three files and
# this seat's probe (JSON reporter). Exit codes unpiped. Run nothing beside this. Win32: POSIX-only rows skip here.
S=/c/qa-scratch/qa130
FILES="tests/harness/config-channel.test.ts tests/harness/configwatch-links.test.ts tests/harness/configwatch-a7-seam.test.ts tests/harness/configwatch-r77-contain.test.ts tests/harness/configwatch-r77-hardlink.test.ts tests/harness/configwatch-r78-read-facts.test.ts tests/harness/configwatch-r79-sides.test.ts tests/harness/configwatch-r80-report.test.ts tests/harness/configwatch-r80-texts.test.ts tests/harness/configwatch-r83.test.ts tests/harness/configwatch-r84.test.ts tests/harness/configwatch-r85.test.ts tests/harness/configwatch-r86.test.ts tests/harness/configwatch-r87.test.ts tests/harness/configwatch-r88.test.ts tests/harness/process-role.test.ts tests/harness/spawn-sites.test.ts tests/harness/refwatch-stage.test.ts tests/harness/runtime.test.ts tests/harness/qa104-a9-probe2.test.ts tests/harness/qa104-a9-probe3.test.ts tests/harness/qa89-a4-probe.test.ts tests/harness/qa92-a5-probe.test.ts tests/harness/qa94-a6-probe.test.ts tests/harness/qa94-handle.test.ts tests/harness/qa96-a7-probe.test.ts tests/harness/qa96-seam.test.ts tests/harness/qa96-b2.test.ts tests/harness/qa99-a8-probe.test.ts tests/harness/qa99-seam.test.ts tests/harness/qa104-a9-probe.test.ts tests/harness/qa104-seam.test.ts tests/harness/qa108-a10-probe.test.ts tests/harness/qa108-a10-probe2.test.ts tests/harness/qa108-r61-copy.test.ts tests/harness/qa130-a11-probe.test.ts"
for m in "$@"; do
  case "$m" in BASELINE*) ob="$S/arch/${m#BASELINE-}/open-brain"; [ "$m" = BASELINE ] && ob="$S/arch/A11/open-brain";; *) ob="$S/mut11/$m/open-brain";; esac
  cd "$ob" || { echo "$m: no tree"; continue; }
  F="$FILES"
  for f in qa89-a4-probe qa92-a5-probe qa94-a6-probe qa94-handle qa96-a7-probe qa96-seam qa96-b2 qa99-a8-probe qa99-seam qa104-a9-probe qa104-seam qa108-a10-probe qa108-a10-probe2 qa108-r61-copy qa130-a11-probe; do cp "$S/probes/$f.test.ts" tests/harness/ || echo "$m: copy $f failed"; done
  for t in $FILES; do [ -f "$t" ] || F=$(echo "$F" | sed "s#$t##"); done
  t0=$(date -u +%T)
  node node_modules/vitest/vitest.mjs run $F --reporter=json --outputFile="C:/qa-scratch/qa130/mut11/$m.rows.json" > "$S/mut11/$m.rows.out" 2>&1
  rc=$?
  echo "$m rows_exit=$rc $t0->$(date -u +%T) unhandled=$(grep -ac 'Unhandled' "$S/mut11/$m.rows.out")"
done
echo DONE
