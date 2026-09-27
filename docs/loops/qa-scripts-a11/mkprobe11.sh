#!/bin/bash
# QA 130 (QA 108's mkprobe10.sh, repointed): the probe commit on A11, and one per CI mutant or FIX (probe set + that
# build's edited files, taken from its asserted local build in mut11/). Prints "<name> <sha>" per commit.
cd /c/qa-scratch/qa130
A11=bbf9d07e81a6ebbc9363586c79b846dfdc4980da
T=open-brain/tests/harness
P=""; for f in probes/*.test.ts; do b=$(basename $f); P="$P $T/$b=/c/qa-scratch/qa130/probes/$b"; done
mk() { local name=$1; shift; local sha; sha=$(bash mkbranch11.sh "$@" 2>>mkprobe11.err) || { echo "$name FAILED"; return 1; }; echo "$name $sha"; }
case "$1" in
  probe) mk probe $A11 "qa(probe): QA 130 probe file, QA 108's three and the carried QA 89-104 probes on A11 bbf9d07 (not for merge)" $P ;;
  mut) shift; for m in "$@"; do
         d=/c/qa-scratch/qa130/mut11/$m/open-brain
         [ -d "$d" ] || { echo "$m NO BUILD"; continue; }
         grep -q TSC_EXIT=0 /c/qa-scratch/qa130/mut11/$m.build.txt || { echo "$m TSC not 0"; continue; }
         F=""; for f in $(grep -o '^landed: [^ ]*' /c/qa-scratch/qa130/mut11/$m.build.txt | sed 's/^landed: //' | sort -u); do F="$F open-brain/$f=$d/$f"; done
         mk "$m" $A11 "qa(mutant): $m on A11 bbf9d07, with the QA 130 probe set (not for merge)" $P $F
       done ;;
esac
