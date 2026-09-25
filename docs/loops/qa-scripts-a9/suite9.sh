#!/bin/bash
# QA 104 (QA 99's suite.sh, repointed): the full suite ONCE, alone, at A9 6bd97f2, in a detached git worktree of the QA repository (the QA tree itself
# stays at the dispatch commit, because the driver reads its stop file and push script from there). npm ci + build,
# the Windows process list just before and just after, exit code captured unpiped.
R="/c/Users/Aaron Melven/Worktrees/sia-qa"
W=/c/qa104/wt-a9
O=/c/qa104/suite
mkdir -p $O
[ -e $W ] || git -C "$R" worktree add --detach $W 6bd97f2a573394ce84f986531975f3d509d484c5 > $O/worktree.out 2>&1; echo "worktree exit=$? HEAD $(git -C $W rev-parse HEAD)"
cd $W/open-brain || exit 2
npm ci > $O/npm-ci.out 2>&1; echo "npm_ci exit=$? $(date -u +%T)"
npm run build > $O/build.out 2>&1; echo "build exit=$? $(date -u +%T)"
echo "porcelain after build: $(git -C $W status --porcelain | wc -l)"
tasklist //V //FO CSV > $O/procs-before.csv 2>&1; echo "procs before: $(($(wc -l < $O/procs-before.csv)-1)) at $(date -u +%T)"
t0=$(date -u +%T)
npx vitest run > $O/suite.out 2>&1
SUITE_EXIT=$?
t1=$(date -u +%T)
tasklist //V //FO CSV > $O/procs-after.csv 2>&1; echo "procs after: $(($(wc -l < $O/procs-after.csv)-1)) at $(date -u +%T)"
echo "SUITE_EXIT=$SUITE_EXIT $t0->$t1"
grep -aE "Test Files |      Tests |Errors |Duration" $O/suite.out | sed -E 's/(\x1b)?\[[0-9;]*m//g'
echo "unhandled matches: $(grep -acE 'Unhandled|onTaskUpdate' $O/suite.out)"
echo "HEAD after suite $(git -C $W rev-parse HEAD); porcelain $(git -C $W status --porcelain | wc -l)"
