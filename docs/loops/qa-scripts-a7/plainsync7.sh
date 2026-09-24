#!/bin/bash
# QA 96 (QA 94 plainsync6.sh, SHA repointed to A7): plain `sync` (fix mode) exit code, taken ONLY in a scratch clone of the QA repository at the candidate.
SP="$TEMP/claude/C--Users-melve-Worktrees-sia-qa/07fe8094-75b7-499f-88b2-6bf1761d35a3/scratchpad"
C="$SP/syncclone"
[ -e "$C" ] && { echo "$C exists; refusing"; exit 2; }
git clone --quiet --no-hardlinks /c/Users/melve/Worktrees/sia-qa "$C" || exit 3
git -C "$C" checkout --quiet --detach d223d1dbe4247fdc0131cd92bfc14288c52d7cf5 || exit 4
echo "clone HEAD $(git -C "$C" rev-parse HEAD)"
(cd "$C/open-brain" && npm ci --silent > "$SP/syncclone-npm.out" 2>&1); echo "NPM_CI_EXIT=$?"
(cd "$C/open-brain" && npm run build > "$SP/syncclone-build.out" 2>&1); echo "BUILD_EXIT=$?"
(cd "$C" && node open-brain/build/cli.js sync --check > "$SP/syncclone-check.out" 2>&1); echo "SYNC_CHECK_EXIT=$?"
(cd "$C" && node open-brain/build/cli.js sync > "$SP/syncclone-plain.out" 2>&1); echo "SYNC_PLAIN_EXIT=$?"
grep -h "Summary:" "$SP/syncclone-check.out" "$SP/syncclone-plain.out"
echo "clone porcelain after plain sync:"; git -C "$C" status --porcelain
echo "QA tree porcelain: $(git -C /c/Users/melve/Worktrees/sia-qa status --porcelain | wc -l)"
