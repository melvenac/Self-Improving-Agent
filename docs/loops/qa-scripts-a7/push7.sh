#!/bin/bash
# QA 96: push each built commit to this seat's own qa/* branch (D-038), read each back with ls-remote, then dispatch CI
# on it (D-040). Push exit codes are captured per push, unpiped.
cd /c/Users/melve/Worktrees/sia-qa || exit 2
OUT="$(dirname "$0")/mkall7.out"
while read name sha; do
  br="qa/loop-15-slice-3-a7-$name"
  git push -q origin "$sha:refs/heads/$br" > /dev/null 2>&1
  rc=$?
  remote=$(git ls-remote origin "refs/heads/$br" | cut -f1)
  echo "$br push_rc=$rc local=$sha remote=$remote match=$([ "$remote" = "$sha" ] && echo yes || echo NO)"
  if [ "$remote" = "$sha" ]; then
    gh workflow run CI --ref "$br" > /dev/null 2>&1
    echo "  dispatch_rc=$?"
  fi
done < "$OUT"
