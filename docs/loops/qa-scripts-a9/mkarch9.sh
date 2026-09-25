#!/bin/bash
# QA 104: git archive <sha>'s open-brain into /c/qa104/arch/<label>, then npm ci and npm run build in it. Exit codes unpiped.
REPO="/c/Users/Aaron Melven/Worktrees/sia-qa"
label=$1; sha=$2
d=/c/qa104/arch/$label
[ -e "$d" ] && { echo "$d exists; refusing"; exit 2; }
mkdir -p "$d"
full=$(git -C "$REPO" rev-parse "$sha^{commit}") || exit 3
git -C "$REPO" archive "$full" open-brain | tar -x -C "$d"; echo "$label archive=$full tar_exit=${PIPESTATUS[1]}"
cd "$d/open-brain" || exit 3
npm ci > /c/qa104/log/ci-$label.out 2>&1; echo "$label npm_ci_exit=$? $(date -u +%T)"
npm run build > /c/qa104/log/build-$label.out 2>&1; echo "$label build_exit=$? $(date -u +%T)"
echo "$label configwatch blob $(git -C "$REPO" hash-object "$d/open-brain/src/harness/configwatch.ts") want $(git -C "$REPO" rev-parse "$full:open-brain/src/harness/configwatch.ts")"
