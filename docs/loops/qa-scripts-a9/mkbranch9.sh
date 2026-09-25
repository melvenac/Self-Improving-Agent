#!/bin/bash
# mkbranch8.sh <base-sha> <message> <repo-path>=<ABSOLUTE local-file> ...
# QA 104 (QA 99's mkbranch8.sh, repointed; QA 92's before it): a commit = <base> + the given files, built with a temporary index, never touching
# the QA work tree. Prints the new commit sha. Source paths must be absolute (git -C resolves relative ones against
# the repository: report A7 section 12).
set -u
# This PC has no git identity configured; set it per command (never in ~/.gitconfig), as the repository's own commits carry it.
export GIT_AUTHOR_NAME="Aaron Melven" GIT_AUTHOR_EMAIL="melvenac@gmail.com" GIT_COMMITTER_NAME="Aaron Melven" GIT_COMMITTER_EMAIL="melvenac@gmail.com"
REPO="/c/Users/Aaron Melven/Worktrees/sia-qa"
base=$1; msg=$2; shift 2
export GIT_INDEX_FILE="/c/qa104/tmpidx.$$"
rm -f "$GIT_INDEX_FILE"
git -C "$REPO" read-tree "$base" || exit 3
for spec in "$@"; do
  path=${spec%%=*}; file=${spec#*=}
  case "$file" in /*) ;; *) echo "not absolute: $file" >&2; exit 4;; esac
  blob=$(git -C "$REPO" hash-object -w "$file") || exit 4
  git -C "$REPO" update-index --add --cacheinfo "100644,$blob,$path" || exit 5
  echo "added $path blob $blob" >&2
done
tree=$(git -C "$REPO" write-tree) || exit 6
rm -f "$GIT_INDEX_FILE"
commit=$(printf '%s\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n' "$msg" | git -C "$REPO" commit-tree "$tree" -p "$base") || exit 7
echo "$commit"
