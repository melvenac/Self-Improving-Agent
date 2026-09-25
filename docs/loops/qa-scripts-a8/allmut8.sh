#!/bin/bash
# QA 99: build (asserted, tsc) then run each mutant at A8, one at a time. A mutant already built with TSC_EXIT=0 is
# not rebuilt. Nothing else local runs beside it.
S=/c/qa99
cd $S
mkdir -p mut8
for m in "$@"; do
  if [ -d "mut8/$m" ] && grep -q 'TSC_EXIT=0' "mut8/$m.build.txt" 2>/dev/null; then
    echo "$m already built TSC_EXIT=0"
  else
    node build8.mjs "$m" > "mut8/$m.build.txt" 2>&1
    b=$?
    tscl=$(grep -o 'TSC_EXIT=[0-9]*' "mut8/$m.build.txt")
    echo "$m build_exit=$b $tscl"
    if [ $b -ne 0 ] || [ "$tscl" != "TSC_EXIT=0" ]; then echo "$m NOT RUN"; continue; fi
  fi
  bash runmut8.sh "$m" | grep -v DONE
done
echo "ALLDONE $(date -u +%T)"
