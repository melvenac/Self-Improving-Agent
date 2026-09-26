#!/bin/sh
# QA 129, second attempt: the developer's EPERM came in an ELD run. Same file pair, TEMP = the default (Defender
# scanning), ELD on, under the load generator (--spawn 4) running standalone. Usage: eperm-loop-load.sh <N> <outdir>
N=$1; OUT=$2; mkdir -p "$OUT"
cd /c/qa-scratch/qa129/cand/open-brain || exit 1
DEF="$QA_DEFAULT_TEMP"
node scripts/load-generator.mjs --spawn 4 --duration 1500 --report "$OUT/loadgen.json" > "$OUT/loadgen.log" 2>&1 &
LG=$!
sleep 3
: > "$OUT/summary.txt"
i=1
while [ $i -le $N ]; do
  for file in state-import-staleness qa129-staleness-orig; do
    log="$OUT/$file-$i.log"
    TEMP="$DEF" TMP="$DEF" OPEN_BRAIN_ELD_DIR="$OUT/eld-$file-$i" npx vitest run "tests/pipelines/$file.test.ts" > "$log" 2>&1
    rc=$?
    tests=$(sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -E '^\s+Tests ' | head -1 | tr -s ' ')
    ep=$(grep -c 'EPERM\|EBUSY\|EACCES' "$log")
    echo "$i $file rc=$rc eperm_lines=$ep $tests" >> "$OUT/summary.txt"
    [ $rc -eq 0 ] && [ $ep -eq 0 ] && rm -f "$log"
  done
  i=$((i+1))
done
kill $LG 2>/dev/null
wait $LG 2>/dev/null
echo "loadgen exit $?" >> "$OUT/summary.txt"
echo DONE >> "$OUT/summary.txt"
