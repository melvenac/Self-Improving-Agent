#!/bin/bash
# QA 96: build (asserted, tsc) then run every applicable mutant at A7, one at a time. Nothing else runs beside it.
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/07fe8094-75b7-499f-88b2-6bf1761d35a3/scratchpad/qa
cd $S
mkdir -p mut7
LIST="M-L0 M-L1 M-L2 M-L2-order M-L2-order+M-L1 M-R18 M-L2+M-R18 M-R16 M-R15 M-backstop M-CAS M-endstate M-L2-norestore M-follow-a7 M-follow-b M-follow-c M-R44 M-R45 M-R45-record M-R45-mkdir M-R46-root M-R43-repo M-R49-repo M-R49-repo+M-R43-repo M-R50 M-R50+agrees-v2 M-R51-refuse-cmd M-2.5-refuse-node M-2.5-accept-cmd M-R55-route M-R57 M-R59-revert M-R59-never M-dev-object M-dev-rest M-dev-unwatched M-dev-revert M-R46-basenotes6 M-R59-read6 M-typechange6 M-handle-narrow7 M-dev-handle7 M-dev-identity7 M-R54-7 M-dev7-drifted M-dev7-facts M-dev7-record M-dev7-r50 M-dev7-r67 M-dev7-trade M-dev7-type M-R29-both M-R67-realpath M-R67-nlink"
[ -n "$1" ] && LIST="$*"
for m in $LIST; do
  node build7.mjs "$m" > "$S/mut7/$m.build.txt" 2>&1
  b=$?
  tscl=$(grep -o 'TSC_EXIT=[0-9]*' "$S/mut7/$m.build.txt")
  echo "$m build_exit=$b $tscl"
  if [ $b -ne 0 ] || [ "$tscl" != "TSC_EXIT=0" ]; then echo "$m NOT RUN"; continue; fi
  bash runmut7.sh "$m" | grep -v DONE
done
echo ALLDONE
