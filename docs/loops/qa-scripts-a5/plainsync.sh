#!/bin/bash
# QA 92: plain `sync` (fix mode) exit code, taken ONLY in a scratch clone of the QA repository at the candidate.
SP="$TEMP/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad"
C="$SP/syncclone"
[ -e "$C" ] && { echo "$C exists; refusing"; exit 2; }
git clone --quiet --no-hardlinks /c/Users/melve/Worktrees/sia-qa "$C" || exit 3
git -C "$C" checkout --quiet --detach 4c1287f4e4b3420909428ba8ce007e03b0daafc5 || exit 4
echo "clone HEAD $(git -C "$C" rev-parse HEAD)"
(cd "$C/open-brain" && npm ci --silent > "$SP/syncclone-npm.out" 2>&1); echo "NPM_CI_EXIT=$?"
(cd "$C/open-brain" && npm run build > "$SP/syncclone-build.out" 2>&1); echo "BUILD_EXIT=$?"
(cd "$C" && node open-brain/build/cli.js sync --check > "$SP/syncclone-check.out" 2>&1); echo "SYNC_CHECK_EXIT=$?"
(cd "$C" && node open-brain/build/cli.js sync > "$SP/syncclone-plain.out" 2>&1); echo "SYNC_PLAIN_EXIT=$?"
grep -h "Summary:" "$SP/syncclone-check.out" "$SP/syncclone-plain.out"
echo "clone porcelain after plain sync:"; git -C "$C" status --porcelain
echo "QA tree porcelain: $(git -C /c/Users/melve/Worktrees/sia-qa status --porcelain | wc -l)"
