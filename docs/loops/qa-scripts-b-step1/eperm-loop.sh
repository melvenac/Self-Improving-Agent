#!/bin/sh
# QA 129: try to reproduce the developer's 1-in-15 EPERM in state-import-staleness.test.ts on the QA PC's NTFS.
# Variants interleaved: converted (candidate) and original (ee0566d) file; TEMP = C:\qa-tmp (Defender-excluded)
# and TEMP = the default (Defender scanning). Usage: eperm-loop.sh <N> <outdir>
N=$1; OUT=$2; mkdir -p "$OUT"
cd /c/qa-scratch/qa129/cand/open-brain || exit 1
DEF="$QA_DEFAULT_TEMP"
: > "$OUT/summary.txt"
i=1
while [ $i -le $N ]; do
  for file in state-import-staleness qa129-staleness-orig; do
    for t in qatmp default; do
      if [ $t = qatmp ]; then T='C:\qa-tmp'; else T="$DEF"; fi
      log="$OUT/$file-$t-$i.log"
      TEMP="$T" TMP="$T" npx vitest run "tests/pipelines/$file.test.ts" > "$log" 2>&1
      rc=$?
      tests=$(sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -E '^\s+Tests ' | head -1 | tr -s ' ')
      ep=$(grep -c 'EPERM\|EBUSY\|EACCES' "$log")
      echo "$i $file $t rc=$rc eperm_lines=$ep $tests" >> "$OUT/summary.txt"
      [ $rc -eq 0 ] && [ $ep -eq 0 ] && rm -f "$log"
    done
  done
  i=$((i+1))
done
echo DONE >> "$OUT/summary.txt"
