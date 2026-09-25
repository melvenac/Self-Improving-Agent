#!/bin/bash
# mkbranch.sh <base-sha> <message> <repo-path>=<local-file> ...
# Builds a commit = <base> + the given files, with a temporary index, never touching the QA work tree.
# Prints the new commit sha. QA record session 92.
set -u
REPO=/c/Users/melve/Worktrees/sia-qa
SP="$TEMP/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad"
base=$1; msg=$2; shift 2
export GIT_INDEX_FILE="$SP/tmpidx.$$"
rm -f "$GIT_INDEX_FILE"
git -C "$REPO" read-tree "$base" || exit 3
for spec in "$@"; do
  path=${spec%%=*}; file=${spec#*=}
  blob=$(git -C "$REPO" hash-object -w "$file") || exit 4
  git -C "$REPO" update-index --add --cacheinfo "100644,$blob,$path" || exit 5
  echo "added $path blob $blob" >&2
done
tree=$(git -C "$REPO" write-tree) || exit 6
rm -f "$GIT_INDEX_FILE"
commit=$(printf '%s\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>\n' "$msg" | git -C "$REPO" commit-tree "$tree" -p "$base") || exit 7
echo "$commit"
