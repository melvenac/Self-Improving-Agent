#!/usr/bin/env bash
# QA 125 check 5 (T179-2): the SessionEnd handoff guard warns and never blocks; a session WITH a handoff gets none;
# the next SessionStart greeting shows the warning exactly once. Runs the candidate's BUILT hooks
# (cli-session-end.js, cli-bootstrap.js) as a host would: a JSON payload on stdin, the project as cwd.
# Every store and HOME point at scratch. usage: c5-guard.sh <cand-root> <scratch-dir>
set -u
export MSYS_NO_PATHCONV=1
CAND="$1"; S="$2/c5"; rm -rf "$S"; mkdir -p "$S/home" "$S/store"
export HOME="$S/home" USERPROFILE="$S/home" KNOWLEDGE_V2_DB="$S/store/none.db" OPEN_BRAIN_ACTIVE_SESSION="$S/store/as.json" \
  OPEN_BRAIN_VAULT_DIR="$S/store/vault" OPEN_BRAIN_IDE=claude CLAUDE_PROJECT_DIR=
END="$CAND/open-brain/build/cli-session-end.js"; START="$CAND/open-brain/build/cli-bootstrap.js"
G() { git -c user.name=qa -c user.email=qa@x "$@"; }
# A project with an origin whose master holds the base, and a transcript whose first line fixes the session start.
git init -q --bare "$S/origin.git"
git init -q -b master "$S/proj"; cd "$S/proj"; mkdir -p .agents/SESSIONS docs/loops; echo x > README.md; cp "$CAND/.gitignore" .gitignore
G add -A; G commit -qm base; git remote add origin "$S/origin.git"; git push -q origin master; git fetch -q origin
OLD=$(date -u -d '-2 hours' +%Y-%m-%dT%H:%M:%SZ)
git switch -q -c loop/old; echo old > old.txt; G add old.txt; GIT_COMMITTER_DATE="$OLD" GIT_AUTHOR_DATE="$OLD" G commit -qm "old work, before the session"
START_AT=$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%S.000Z)
tr() { printf '{"type":"user","timestamp":"%s","message":"hi"}\n{"type":"assistant","timestamp":"%s"}\n' "$START_AT" "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" > "$1"; }
payload() { printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","hook_event_name":"%s","reason":"clear"}' "$1" "$2" "$S/proj" "$3"; }
hook_end() { payload "$1" "$2" SessionEnd | node "$END" > "$S/out.txt" 2> "$S/err.txt"; echo "  exit=$? stdout: $(grep -h 'handoff\|HANDOFF' "$S/out.txt" | cut -c1-260)"; echo "  stderr: $(grep -h 'HANDOFF' "$S/err.txt" | cut -c1-80)"; }
hook_start() { payload "$1" "$2" SessionStart | node "$START" > "$S/start.txt" 2>&1; echo "  exit=$? HANDOFF lines in greeting: $(grep -c 'HANDOFF MISSING' "$S/start.txt")"; }

echo "T0 no commits in the window (only loop/old, committed before the session start):"
tr "$S/t0.jsonl"; hook_end 00000000-0000-4000-8000-000000000000 "$S/t0.jsonl"

echo "T1 session A commits on loop/a with NO handoff:"
git switch -q -c loop/a master; echo a > a.txt; G add a.txt; G commit -qm "work A"
tr "$S/t1.jsonl"; hook_end aaaaaaaa-0000-4000-8000-000000000001 "$S/t1.jsonl"
echo "  marker: $(test -f .agents/SESSIONS/.missing-handoff.jsonl && wc -l < .agents/SESSIONS/.missing-handoff.jsonl) line(s); git status sees it: $(git status --porcelain --ignored .agents | grep -c missing-handoff) ignored/untracked entry, tracked-dirty: $(git status --porcelain | grep -c missing)"
echo "T2 the next session's greeting, twice:"
hook_start bbbbbbbb-0000-4000-8000-000000000002 "$S/t1.jsonl"; grep -h "HANDOFF MISSING" "$S/start.txt" | cut -c1-200
hook_start bbbbbbbb-0000-4000-8000-000000000002 "$S/t1.jsonl"
echo "  marker after: $(test -f .agents/SESSIONS/.missing-handoff.jsonl && echo present || echo moved-aside); shown log: $(wc -l < .agents/SESSIONS/.missing-handoff.shown.jsonl) line(s)"

echo "T3 session commits work AND a handoff on another loop/* branch (per session, not per branch):"
git switch -q -c loop/b-mut master; echo m > m.txt; G add m.txt; G commit -qm "mutant"
git switch -q -c loop/b master; mkdir -p docs/loops; echo h > docs/loops/b-developer-handoff.md; G add docs; G commit -qm handoff
git switch -q master; git branch -q -D loop/a
tr "$S/t3.jsonl"; hook_end cccccccc-0000-4000-8000-000000000003 "$S/t3.jsonl"
echo "  marker: $(test -f .agents/SESSIONS/.missing-handoff.jsonl && echo WRITTEN || echo none)"

echo "T4 a handoff named otherwise (docs/loops/b-notes.md) and one outside docs/loops (HANDOFF.md):"
git switch -q master; git branch -q -D loop/b loop/b-mut; git switch -q -c loop/c master; mkdir -p docs/loops; echo n > docs/loops/c-notes.md; echo n > HANDOFF.md; G add -A; G commit -qm "notes, not a *-handoff.md"
tr "$S/t4.jsonl"; hook_end dddddddd-0000-4000-8000-000000000004 "$S/t4.jsonl"; rm -f .agents/SESSIONS/.missing-handoff.jsonl

echo "T5 never blocks: no transcript; a corrupt transcript; git broken (HEAD file garbage); stdin not JSON:"
hook_end eeeeeeee-0000-4000-8000-000000000005 "$S/does-not-exist.jsonl"
printf 'not json\n\x00\xff' > "$S/bad.jsonl"; hook_end eeeeeeee-0000-4000-8000-000000000005 "$S/bad.jsonl"
cp .git/HEAD "$S/HEAD.bak"; echo garbage > .git/HEAD; hook_end eeeeeeee-0000-4000-8000-000000000005 "$S/t4.jsonl"; cp "$S/HEAD.bak" .git/HEAD
echo 'this is not json' | node "$END" > "$S/out.txt" 2>&1; echo "  stdin garbage: exit=$? $(grep -h 'handoff' "$S/out.txt" | cut -c1-160)"
rm -f .agents/SESSIONS/.missing-handoff.jsonl

echo "T6 another session committing to loop/* in this checkout in the same window is counted as this one's (stated limit):"
git switch -q -c loop/e master; echo e > e.txt; G add e.txt; G commit -qm "someone else's work"
tr "$S/t6.jsonl"; hook_end ffffffff-0000-4000-8000-000000000006 "$S/t6.jsonl"; rm -f .agents/SESSIONS/.missing-handoff.jsonl

echo "T7 a handoff arriving only through a MERGE commit (merge of a docs branch into loop/f):"
git switch -q master; git branch -q -D loop/c loop/e; git switch -q -c docs/h master; mkdir -p docs/loops; echo h > docs/loops/f-developer-handoff.md; G add docs; G commit -qm "handoff on a docs branch"
git switch -q -c loop/f master; echo f > f.txt; G add f.txt; G commit -qm "work f"; G merge -q --no-ff docs/h -m "merge handoff"
tr "$S/t7.jsonl"; hook_end 77777777-0000-4000-8000-000000000007 "$S/t7.jsonl"; rm -f .agents/SESSIONS/.missing-handoff.jsonl
