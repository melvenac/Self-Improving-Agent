#!/bin/bash
# cidiff.sh <base-run> <run> — QA 130 (QA 108 cidiff10.sh, repointed): tests red in <run> and not red in <base-run> (kills), and the reverse (healed),
# by test name with durations stripped. Both logs must already be fetched by cilog.sh.
n() { grep -aE ' × ' /c/qa-scratch/qa130/ci/$1.txt | sed -E 's/^.*Z  ?× //; s/ [0-9]+ms$//' | sort -u; }
comm -13 <(n $1) <(n $2) | sed 's/^/  KILL /'
comm -23 <(n $1) <(n $2) | sed 's/^/  HEALED /'
