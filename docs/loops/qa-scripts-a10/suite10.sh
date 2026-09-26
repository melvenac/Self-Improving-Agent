#!/bin/bash
# QA 108: the full suite ONCE at the frozen SHA, in the detached worktree wt-a10 (4b7a5ae), with TEMP/TMP set back to
# the driver's default temp (QA_DEFAULT_TEMP) so that Defender scans the tests' files: the Defender-on control (T-190).
# Captured unpiped (vitest > file; SUITE_EXIT=$?). Process lists (tasklist /V, CSV) just before and just after.
O=/c/qa-scratch/qa108/suite
mkdir -p $O
W=/c/qa-scratch/qa108/wt-a10
[ -n "$QA_DEFAULT_TEMP" ] || { echo "QA_DEFAULT_TEMP not set; refusing"; exit 2; }
echo "HEAD $(git -C $W rev-parse HEAD) porcelain=$(git -C $W status --porcelain | wc -l)"
DT=$(cygpath -u "$QA_DEFAULT_TEMP")
echo "default temp: $QA_DEFAULT_TEMP ($DT) exists=$([ -d "$DT" ] && echo yes || echo no)"
tasklist //V //FO CSV > $O/procs-before.csv; echo "procs before: $(($(wc -l < $O/procs-before.csv)-1))"
t0=$(date -u +%FT%TZ)
( cd $W/open-brain && TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > $O/suite.out 2>&1 ); SUITE_EXIT=$?
t1=$(date -u +%FT%TZ)
tasklist //V //FO CSV > $O/procs-after.csv; echo "procs after: $(($(wc -l < $O/procs-after.csv)-1))"
echo "SUITE_EXIT=$SUITE_EXIT $t0 -> $t1"
sed 's/\x1b\[[0-9;]*m//g' $O/suite.out | grep -aE "Test Files|Tests  |Duration|Errors" 
echo "unhandled: $(grep -acE 'Unhandled|onTaskUpdate' $O/suite.out)"
echo "HEAD after $(git -C $W rev-parse HEAD) porcelain=$(git -C $W status --porcelain | wc -l)"
