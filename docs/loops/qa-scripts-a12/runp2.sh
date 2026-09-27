#!/bin/bash
# QA 149: probe 2 alone (qa149-a12-probe2.test.ts) in each tree (arch/A12 for BASELINE, else mut/<name>), JSON reporter
# plus the default reporter's printed lines. Exit codes unpiped. Run after the mutant batch, never beside it.
S=/c/qa-scratch/qa149
for m in "$@"; do
  case "$m" in BASELINE) ob="$S/arch/A12/open-brain";; *) ob="$S/mut/$m/open-brain";; esac
  cd "$ob" || { echo "$m: no tree"; continue; }
  cp "$S/probes/qa149-a12-probe2.test.ts" tests/harness/ || echo "$m: copy failed"
  node node_modules/vitest/vitest.mjs run tests/harness/qa149-a12-probe2.test.ts --reporter=default --reporter=json --outputFile.json="C:/qa-scratch/qa149/mut/$m.p2.json" > "$S/mut/$m.p2.out" 2>&1
  echo "$m p2_exit=$? $(sed 's/\x1b\[[0-9;]*m//g' "$S/mut/$m.p2.out" | grep -aE '^ +Tests ' | head -1)"
done
echo DONE
