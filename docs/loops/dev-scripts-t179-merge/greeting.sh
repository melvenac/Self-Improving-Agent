#!/usr/bin/env bash
# T-179 merge round: the greeting re-measured, with handoff section 8's instrument (t179-developer-handoff.md).
# handleStart({project_root}) is imported from each build's own build/server.js, one process per seat, in a scratch
# `git clone --shared` of this repository at that build's SHA, which is its own project root. The seat comes from an
# AGENT.local.md written into the clone per run. Every store the server can touch is pointed at scratch.
#
# Differences from section 8, deliberate: the clone directories have names of EQUAL length (gs-m, gs-t, gs-x), so the
# session-log path adds no artefact (section 8 had -1 from gs-after vs gs-before).
#
# usage (from the repo root, bash): docs/loops/dev-scripts-t179-merge/greeting.sh <scratch-dir> <out-file>
set -u
REPO="$(pwd)"
S="$1"; OUT="$2"
: > "$OUT"
export KNOWLEDGE_V2_DB="$S/gs-store/knowledge.db" OPEN_BRAIN_ACTIVE_SESSION="$S/gs-store/active-session.json" \
  OPEN_BRAIN_SCORE_HISTORY="$S/gs-store/score.jsonl" OPEN_BRAIN_SHADOW_LOG="$S/gs-store/shadow.jsonl" \
  OPEN_BRAIN_VAULT_DIR="$S/gs-store/vault"
mkdir -p "$S/gs-store/vault"

# label sha migrate?
for spec in "m aae0dce no" "t 66b2173 yes" "x 3c0bfdc yes"; do
  set -- $spec; L=$1; SHA=$2; MIG=$3; D="$S/gs-$L"
  rm -rf "$D"; git clone -q --shared "$REPO" "$D" && git -C "$D" checkout -q --detach "$SHA" || { echo "$L: clone failed" >> "$OUT"; continue; }
  powershell -NoProfile -Command "New-Item -ItemType Junction -Path '$(cygpath -w "$D/open-brain/node_modules")' -Target '$(cygpath -w "$REPO/open-brain/node_modules")' | Out-Null"
  (cd "$D/open-brain" && node node_modules/typescript/bin/tsc -p .) || { echo "$L: build failed" >> "$OUT"; continue; }
  REC="record at $(git -C "$D" rev-parse --short HEAD)"
  if [ "$MIG" = yes ]; then
    (cd "$D" && node open-brain/build/cli.js state migrate .agents/state.json >> "$OUT.migrate" 2>&1) || { echo "$L: migrate failed" >> "$OUT"; continue; }
    git -C "$D" -c user.name=m -c user.email=m@x commit -q -am "scratch: migrate to v3" && REC="$REC, migrated by this build and committed in the clone"
  fi
  REV=$(node -e "const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('schema v'+s.schema_version+' rev '+s.revision)" "$D/.agents/state.json")
  for seat in planner developer qa; do
    printf -- "---\nname: Seat\nrole: %s\npartner: Atlas\n---\n" "$seat" > "$D/.agents/AGENT.local.md"
    rm -rf "$D/.agents/SESSIONS"/Session_*.md
    node --input-type=module -e "
      const m = await import(process.argv[1]);
      const r = await m.handleStart({ project_root: process.argv[2] });
      const t = r.content.map((c) => c.text).join('\n');
      (await import('node:fs')).writeFileSync(process.argv[6], t);
      console.log([process.argv[3], process.argv[4], process.argv[5], t.length, t.split(/\s+/).filter(Boolean).length, t.split('\n').length].join('\t'));
    " "file:///$(cygpath -m "$D/open-brain/build/server.js")" "$(cygpath -w "$D")" "$L:$SHA" "$seat" "$REV" "$(cygpath -w "$S/gs-text-$L-$seat.txt")" >> "$OUT" 2>>"$OUT.err"
  done
  echo "# $L $SHA: $REC ($REV)" >> "$OUT"
done
