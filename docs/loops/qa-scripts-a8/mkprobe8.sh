#!/bin/bash
# QA 99: the probe commits on A8 and on A7 (the known positive), and one per CI mutant (probe set + that mutant's
# configwatch.ts from its asserted local build). Prints "<name> <sha>" per commit.
cd /c/qa99
A8=9e2dd5dd8762f95431cffc80cab65f7c02885724
A7=d223d1dbe4247fdc0131cd92bfc14288c52d7cf5
T=open-brain/tests/harness
P="$T/qa89-a4-probe.test.ts=/c/qa99/qa89-a4-probe.test.ts $T/qa92-a5-probe.test.ts=/c/qa99/qa92-a5-probe.v3.test.ts $T/qa94-a6-probe.test.ts=/c/qa99/qa94-a6-probe.test.ts $T/qa94-handle.test.ts=/c/qa99/qa94-handle.test.ts $T/qa96-a7-probe.test.ts=/c/qa99/qa96-a7-probe.test.ts $T/qa96-seam.test.ts=/c/qa99/qa96-seam.test.ts $T/qa96-b2.test.ts=/c/qa99/qa96-b2.test.ts $T/qa99-a8-probe.test.ts=${QA99PROBE:-/c/qa99/qa99-a8-probe.test.ts} $T/qa99-seam.test.ts=/c/qa99/qa99-seam.test.ts"
C=open-brain/src/harness/configwatch.ts
mk() { local name=$1; shift; local sha; sha=$(bash mkbranch8.sh "$@" 2>>mkprobe8.err) || { echo "$name FAILED"; return 1; }; echo "$name $sha"; }
case "$1" in
  probe) mk probe $A8 "qa(probe): QA 99 probe files on A8 9e2dd5d (not for merge)" $P
         mk probe-on-a7 $A7 "qa(probe): QA 99 probe files on A7 d223d1d, the known positive (not for merge)" $P ;;
  mut) shift; for m in "$@"; do
         f=/c/qa99/mut8/$m/open-brain/src/harness/configwatch.ts
         [ -f "$f" ] || { echo "$m NO BUILD"; continue; }
         grep -q TSC_EXIT=0 /c/qa99/mut8/$m.build.txt || { echo "$m TSC not 0"; continue; }
         b=$(echo "$m" | tr 'A-Z' 'a-z' | sed 's/^m-//')
         mk "m-$b" $A8 "qa(mutant): $m on A8 9e2dd5d (not for merge)" $P $C=$f
       done ;;
esac
