#!/bin/bash
# QA 96, window part 3: the QA tree to the frozen SHA, build, full suite (exit captured unpiped), gitnexus analyze,
# sync --check, and plain sync in a scratch clone. One at a time.
S=/c/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/07fe8094-75b7-499f-88b2-6bf1761d35a3/scratchpad/qa
Q=/c/Users/melve/Worktrees/sia-qa
A7=d223d1dbe4247fdc0131cd92bfc14288c52d7cf5
cd $Q
echo "porcelain before checkout: $(git status --porcelain | wc -l)"
git checkout --quiet --detach $A7; echo "checkout exit=$?"
echo "HEAD $(git rev-parse HEAD) at $(date -u +%T)"
cd $Q/open-brain
npm run build > $S/win/build.out 2>&1; echo "build exit=$? $(date -u +%T)"
echo "porcelain after build: $(git -C $Q status --porcelain | wc -l)"
t0=$(date -u +%T)
npx vitest run > $S/win/suite.out 2>&1
SUITE_EXIT=$?
echo "SUITE_EXIT=$SUITE_EXIT $t0->$(date -u +%T)"
grep -E "Test Files |      Tests |Errors |Duration" $S/win/suite.out
echo "unhandled matches: $(grep -cE 'Unhandled|onTaskUpdate' $S/win/suite.out)"
echo "HEAD after suite $(git -C $Q rev-parse HEAD); porcelain $(git -C $Q status --porcelain | wc -l)"
echo SUITEDONE
