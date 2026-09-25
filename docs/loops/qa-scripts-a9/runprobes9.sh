#!/bin/bash
# QA 104 (QA 99's runprobes.sh, repointed): every probe file (POSIX-only tests skip on win32) on an archive copy,
# verbose + JSON reporters. Exit unpiped.
t=$1
PF="qa89-a4-probe.test.ts qa92-a5-probe.test.ts qa94-a6-probe.test.ts qa94-handle.test.ts qa96-a7-probe.test.ts qa96-seam.test.ts qa96-b2.test.ts qa99-a8-probe.test.ts qa99-seam.test.ts qa104-a9-probe.test.ts qa104-seam.test.ts"
cd /c/qa104/arch/$t/open-brain || exit 2
for f in qa89-a4-probe qa94-a6-probe qa94-handle qa96-a7-probe qa96-seam qa96-b2 qa99-a8-probe qa99-seam qa104-a9-probe qa104-seam; do cp /c/qa104/$f.test.ts tests/harness/ || echo "copy $f failed"; done
cp /c/qa104/qa92-a5-probe.v3.test.ts tests/harness/qa92-a5-probe.test.ts
F=""; for f in $PF; do F="$F tests/harness/$f"; done
t0=$(date -u +%T)
node node_modules/vitest/vitest.mjs run $F --reporter=verbose --reporter=json --outputFile.json=C:/qa104/win/probes-$t.json > /c/qa104/win/probes-$t.out 2>&1
echo "probes $t exit=$? $t0->$(date -u +%T)"
