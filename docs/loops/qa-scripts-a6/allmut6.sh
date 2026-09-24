#!/bin/bash
# QA 94: build (asserted, tsc) then run every applicable mutant at A6, one at a time. Nothing else runs beside it.
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/08650273-2511-4f23-8fbc-6b4796c2a257/scratchpad/qa
cd $S
LIST="M-L0 M-L1 M-L2 M-L2-order M-L2-order+M-L1 M-R18 M-L2+M-R18 M-R16 M-R15 M-backstop M-CAS M-endstate M-L2-norestore M-follow-a M-follow-b M-follow-c M-R44 M-R45 M-R45-record M-R45-mkdir M-R46-root M-R43-repo M-R49-repo M-R49-repo+M-R43-repo M-R50 M-R50+agrees-v2 M-R51-refuse-cmd M-2.5-refuse-node M-2.5-accept-cmd M-R55-route M-R57 M-R59-revert M-R59-never M-dev-object M-dev-handle M-dev-rest M-dev-unwatched M-dev-identity M-dev-revert M-R46-basenotes6 M-R54-6 M-R59-read6 M-typechange6"
for m in $LIST; do
  node build6.mjs "$m" > "$S/mut6/$m.build.txt" 2>&1
  b=$?
  tscl=$(grep -o 'TSC_EXIT=[0-9]*' "$S/mut6/$m.build.txt")
  echo "$m build_exit=$b $tscl"
  if [ $b -ne 0 ] || [ "$tscl" != "TSC_EXIT=0" ]; then echo "$m NOT RUN"; continue; fi
  bash runmut6.sh "$m" | grep -v DONE
done
echo ALLDONE
