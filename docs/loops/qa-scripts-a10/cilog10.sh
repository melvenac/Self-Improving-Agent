#!/bin/bash
# cilog.sh <run-id> [grep-pattern] — QA 92/96's, repointed: fetch a CI run's log once, strip ANSI, print head sha,
# conclusion, runner identity, summary lines, every failed test, and the per-test lines matching the pattern.
# QA 108 (QA 104's cilog9.sh, repointed to C:/qa-scratch/qa108; from QA 99): the log carries ANSI codes either as ESC or as the two literal characters ^[ ; both are stripped.
SP=/c/qa-scratch/qa108/ci
r=$1; pat=${2:-ZZZNOMATCH}
cd "/c/Users/Aaron Melven/Worktrees/sia-qa" || exit 2
gh run view "$r" --json headSha,headBranch,conclusion,event,createdAt,updatedAt > "$SP/$r.meta.json" || exit 3
cat "$SP/$r.meta.json"; echo
if [ ! -s "$SP/$r.txt" ]; then
  [ -s "$SP/$r.log" ] || gh run view "$r" --log > "$SP/$r.log" 2>&1 || { echo "log fetch failed"; exit 4; }
  node -e 'const fs=require("fs");fs.writeFileSync(process.argv[2],fs.readFileSync(process.argv[1],"utf8").replace(/(\x1b|\^\[)\[[0-9;]*m/g,""))' "$SP/$r.log" "$SP/$r.txt"
fi
T="$SP/$r.txt"
grep -aE "Runner name:|Machine name:|Hosted Compute Agent|Image: |git version 2|Test Files|      Tests  |Errors  |Unhandled|onTaskUpdate" "$T" | sed 's/^.*Z //' | sort -u
echo "pass=$(grep -acE ' ✓ ' "$T") fail=$(grep -acE ' × ' "$T") skip=$(grep -acE ' ↓ ' "$T")"
echo "-- failed:"; grep -aE ' × ' "$T" | sed 's/^.*Z //' | cut -c1-220
echo "-- matching '$pat':"; grep -aE ' ✓ | × | ↓ ' "$T" | grep -aE "$pat" | sed 's/^.*Z //' | cut -c1-220
