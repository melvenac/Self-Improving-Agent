#!/bin/bash
# cilog.sh <run-id> [grep-pattern] — fetch a CI run's log once, strip ANSI, print head sha, conclusion, summary lines,
# every failed test, and the per-test lines matching the pattern. QA record session 92.
SP="$TEMP/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad/ci"
mkdir -p "$SP"
r=$1; pat=${2:-ZZZNOMATCH}
cd /c/Users/melve/Worktrees/sia-qa || exit 2
gh run view "$r" --json headSha,headBranch,conclusion,event,createdAt,updatedAt > "$SP/$r.meta.json" || exit 3
cat "$SP/$r.meta.json"; echo
if [ ! -s "$SP/$r.txt" ]; then
  gh run view "$r" --log > "$SP/$r.log" 2>&1 || { echo "log fetch failed"; exit 4; }
  sed -E 's/\x1b\[[0-9;]*m//g' "$SP/$r.log" > "$SP/$r.txt"
fi
T="$SP/$r.txt"
grep -E "git version 2|Test Files  |      Tests  |Errors  |Unhandled|onTaskUpdate" "$T" | sed 's/^.*Z //' | sort -u
echo "pass=$(grep -cE ' ✓ ' "$T") fail=$(grep -cE ' × ' "$T") skip=$(grep -cE ' ↓ ' "$T")"
echo "-- failed:"; grep -E ' × ' "$T" | sed 's/^.*Z //' | cut -c1-200
echo "-- matching '$pat':"; grep -E ' ✓ | × | ↓ ' "$T" | grep -E "$pat" | sed 's/^.*Z //' | cut -c1-200
