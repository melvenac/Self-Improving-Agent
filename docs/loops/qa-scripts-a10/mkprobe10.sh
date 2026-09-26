#!/bin/bash
# QA 108 (QA 104's mkprobe9.sh, repointed): the probe commit on A10, and one per CI mutant or FIX (probe set + that
# build's edited files, taken from its asserted local build in mut10/). Prints "<name> <sha>" per commit.
cd /c/qa-scratch/qa108
A10=4b7a5aebd9a17b0ce8e6ee99545f4f8f5784c90f
T=open-brain/tests/harness
P=""; for f in probes/*.test.ts; do b=$(basename $f); P="$P $T/$b=/c/qa-scratch/qa108/probes/$b"; done
mk() { local name=$1; shift; local sha; sha=$(bash mkbranch10.sh "$@" 2>>mkprobe10.err) || { echo "$name FAILED"; return 1; }; echo "$name $sha"; }
case "$1" in
  probe) mk probe $A10 "qa(probe): QA 108 probe files and the carried QA 89-104 probes on A10 4b7a5ae (not for merge)" $P ;;
  probe2) mk probe2 $A10 "qa(probe): QA 108 probe files (with probe 2, begin) and the carried QA 89-104 probes on A10 4b7a5ae (not for merge)" $P ;;
  mut) shift; for m in "$@"; do
         d=/c/qa-scratch/qa108/mut10/$m/open-brain
         [ -d "$d" ] || { echo "$m NO BUILD"; continue; }
         grep -q TSC_EXIT=0 /c/qa-scratch/qa108/mut10/$m.build.txt || { echo "$m TSC not 0"; continue; }
         F=""; for f in $(grep -o '^landed: [^ ]*' /c/qa-scratch/qa108/mut10/$m.build.txt | sed 's/^landed: //' | sort -u); do F="$F open-brain/$f=$d/$f"; done
         mk "$m" $A10 "qa(mutant): $m on A10 4b7a5ae, with the QA 108 probe set (not for merge)" $P $F
       done ;;
esac
