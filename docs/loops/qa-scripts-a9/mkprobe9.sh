#!/bin/bash
# QA 104 (QA 99's mkprobe8.sh, repointed): the probe commits on A9 and on A8 (the known positive), and one per CI
# mutant (probe set + that mutant's edited files from its asserted local build). Prints "<name> <sha>" per commit.
# The A8 commit also carries A9's .github/workflows/ci.yml, so that it runs on the same tcm runners as the A9 commits.
cd /c/qa104
A9=6bd97f2a573394ce84f986531975f3d509d484c5
A8=9e2dd5dd8762f95431cffc80cab65f7c02885724
T=open-brain/tests/harness
P="$T/qa89-a4-probe.test.ts=/c/qa104/qa89-a4-probe.test.ts $T/qa92-a5-probe.test.ts=/c/qa104/qa92-a5-probe.v3.test.ts $T/qa94-a6-probe.test.ts=/c/qa104/qa94-a6-probe.test.ts $T/qa94-handle.test.ts=/c/qa104/qa94-handle.test.ts $T/qa96-a7-probe.test.ts=/c/qa104/qa96-a7-probe.test.ts $T/qa96-seam.test.ts=/c/qa104/qa96-seam.test.ts $T/qa96-b2.test.ts=/c/qa104/qa96-b2.test.ts $T/qa99-a8-probe.test.ts=/c/qa104/qa99-a8-probe.test.ts $T/qa99-seam.test.ts=/c/qa104/qa99-seam.test.ts $T/qa104-a9-probe.test.ts=/c/qa104/qa104-a9-probe.test.ts $T/qa104-seam.test.ts=/c/qa104/qa104-seam.test.ts $T/qa104-a9-probe2.test.ts=/c/qa104/qa104-a9-probe2.test.ts $T/qa104-a9-probe3.test.ts=/c/qa104/qa104-a9-probe3.test.ts"
mk() { local name=$1; shift; local sha; sha=$(bash mkbranch9.sh "$@" 2>>mkprobe9.err) || { echo "$name FAILED"; return 1; }; echo "$name $sha"; }
case "$1" in
  probe3-on-a8) mk probe3-on-a8 $A8 "qa(probe): QA 104 probe files, probe 2 and probe 3 on A8 9e2dd5d, with A9's ci.yml (not for merge)" $P .github/workflows/ci.yml=/c/qa104/ci-a9.yml ;;
  probe3) mk probe3 $A9 "qa(probe): QA 104 probe files, probe 2 and probe 3 on A9 6bd97f2 (not for merge)" $P ;;
  probe2) mk probe2 $A9 "qa(probe): QA 104 probe files and probe 2 on A9 6bd97f2 (not for merge)" $P ;;
  probe) git -C "/c/Users/Aaron Melven/Worktrees/sia-qa" show $A9:.github/workflows/ci.yml > /c/qa104/ci-a9.yml
         mk probe $A9 "qa(probe): QA 104 probe files on A9 6bd97f2 (not for merge)" $P
         mk probe-on-a8 $A8 "qa(probe): QA 104 probe files on A8 9e2dd5d, the known positive, with A9's ci.yml (not for merge)" $P .github/workflows/ci.yml=/c/qa104/ci-a9.yml ;;
  mut) shift; for m in "$@"; do
         d=/c/qa104/mut9/$m/open-brain
         [ -d "$d" ] || { echo "$m NO BUILD"; continue; }
         grep -q TSC_EXIT=0 /c/qa104/mut9/$m.build.txt || { echo "$m TSC not 0"; continue; }
         F=""; for f in $(grep -o '^landed: [^ ]*' /c/qa104/mut9/$m.build.txt | sed 's/^landed: //' | sort -u); do F="$F open-brain/$f=$d/$f"; done
         b=$(echo "$m" | tr 'A-Z' 'a-z' | sed 's/^m-//')
         mk "$b" $A9 "qa(mutant): $m on A9 6bd97f2 (not for merge)" $P $F
       done ;;
esac
