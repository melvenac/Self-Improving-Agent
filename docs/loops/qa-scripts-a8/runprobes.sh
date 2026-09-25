#!/bin/bash
# QA 99: the probe files (all of them; POSIX-only tests skip on win32) on an archive copy, JSON reporter. Exit unpiped.
t=$1
PF="qa89-a4-probe.test.ts qa92-a5-probe.test.ts qa94-a6-probe.test.ts qa94-handle.test.ts qa96-a7-probe.test.ts qa96-seam.test.ts qa96-b2.test.ts qa99-a8-probe.test.ts qa99-seam.test.ts"
cd /c/qa99/arch/$t/open-brain || exit 2
cp /c/qa99/qa89-a4-probe.test.ts /c/qa99/qa94-a6-probe.test.ts /c/qa99/qa94-handle.test.ts /c/qa99/qa96-a7-probe.test.ts /c/qa99/qa96-seam.test.ts /c/qa99/qa96-b2.test.ts /c/qa99/qa99-a8-probe.test.ts /c/qa99/qa99-seam.test.ts tests/harness/
cp /c/qa99/qa92-a5-probe.v3.test.ts tests/harness/qa92-a5-probe.test.ts
F=""; for f in $PF; do F="$F tests/harness/$f"; done
mkdir -p /c/qa99/win
t0=$(date -u +%T)
node node_modules/vitest/vitest.mjs run $F --reporter=verbose --reporter=json --outputFile.json=C:/qa99/win/probes-$t.json > /c/qa99/win/probes-$t.out 2>&1
echo "probes $t exit=$? $t0->$(date -u +%T)"
