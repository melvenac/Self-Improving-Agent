#!/bin/bash
# QA 108 (QA 104's plainsync9.sh, repointed to A10): plain `sync` (fix mode) and `sync --check` exit codes, taken ONLY in
# a scratch clone of the QA repository at the candidate. The QA tree is never written.
C=/c/qa-scratch/qa108/syncclone
O=/c/qa-scratch/qa108/sync
mkdir -p $O
[ -e "$C" ] && { echo "$C exists; refusing"; exit 2; }
git clone --quiet --no-hardlinks "/c/Users/Aaron Melven/Worktrees/sia-qa" "$C" || exit 3
git -C "$C" checkout --quiet --detach 4b7a5aebd9a17b0ce8e6ee99545f4f8f5784c90f || exit 4
echo "clone HEAD $(git -C "$C" rev-parse HEAD)"
(cd "$C/open-brain" && npm ci --silent > $O/npm.out 2>&1); echo "NPM_CI_EXIT=$?"
(cd "$C/open-brain" && npm run build > $O/build.out 2>&1); echo "BUILD_EXIT=$?"
(cd "$C" && node open-brain/build/cli.js sync --check > $O/check.out 2>&1); echo "SYNC_CHECK_EXIT=$?"
(cd "$C" && node open-brain/build/cli.js sync > $O/plain.out 2>&1); echo "SYNC_PLAIN_EXIT=$?"
grep -h "Summary:" $O/check.out $O/plain.out
echo "clone porcelain after plain sync:"; git -C "$C" status --porcelain
echo "QA tree porcelain: $(git -C "/c/Users/Aaron Melven/Worktrees/sia-qa" status --porcelain | wc -l)"
