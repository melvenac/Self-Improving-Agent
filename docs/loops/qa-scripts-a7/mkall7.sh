#!/bin/bash
# QA 96: build the probe and mutant commits with a temporary index (the QA tree is never touched), print each SHA.
cd "$(dirname "$0")"; D=$(pwd -W)
A7=d223d1dbe4247fdc0131cd92bfc14288c52d7cf5
A6=dc35b24869e77d2b62729d12598fb50e5adcd24b
T=open-brain/tests/harness
P="$T/qa89-a4-probe.test.ts=$D/qa89-a4-probe.test.ts $T/qa92-a5-probe.test.ts=$D/qa92-a5-probe.v3.test.ts $T/qa94-a6-probe.test.ts=$D/qa94-a6-probe.test.ts $T/qa94-handle.test.ts=$D/qa94-handle.test.ts $T/qa96-a7-probe.test.ts=$D/qa96-a7-probe.test.ts $T/qa96-seam.test.ts=$D/qa96-seam.test.ts"
C=open-brain/src/harness/configwatch.ts
mk() { local name=$1; shift; local sha; sha=$(bash mkbranch.sh "$@") || { echo "$name FAILED"; return 1; }; echo "$name $sha"; }
mk probe       $A7 "qa(probe): QA 96 probe files on A7 d223d1d (not for merge)" $P
mk probe-on-a6 $A6 "qa(probe): QA 96 probe files on A6 dc35b24, the transition control (not for merge)" $P
mk m-r29-both      $A7 "qa(mutant): M-R29-both on A7 - the at-path type change and the different-file gate removed (not for merge)" $P $C=$D/ci-mut/M-R29-both/configwatch.ts
mk m-r67-realpath  $A7 "qa(mutant): M-R67-realpath on A7 - R67 condition 1 (same realpath) removed (not for merge)" $P $C=$D/ci-mut/M-R67-realpath/configwatch.ts
mk m-r67-nlink     $A7 "qa(mutant): M-R67-nlink on A7 - nlink === 1 dropped from R67 condition 2 (not for merge)" $P $C=$D/ci-mut/M-R67-nlink/configwatch.ts
