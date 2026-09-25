#!/bin/bash
# QA 104 (QA 99's allmut8.sh, repointed): build (asserted, tsc) then run each mutant at A9, one at a time. A mutant already built with TSC_EXIT=0 is
# not rebuilt. Nothing else local runs beside it.
S=/c/qa104
cd $S
mkdir -p mut9
for m in "$@"; do
  if [ -d "mut9/$m" ] && grep -q 'TSC_EXIT=0' "mut9/$m.build.txt" 2>/dev/null; then
    echo "$m already built TSC_EXIT=0"
  else
    node build9.mjs "$m" > "mut9/$m.build.txt" 2>&1
    b=$?
    tscl=$(grep -o 'TSC_EXIT=[0-9]*' "mut9/$m.build.txt")
    echo "$m build_exit=$b $tscl"
    if [ $b -ne 0 ] || [ "$tscl" != "TSC_EXIT=0" ]; then echo "$m NOT RUN"; continue; fi
  fi
  bash runmut9.sh "$m" | grep -v DONE
done
echo "ALLDONE $(date -u +%T)"
