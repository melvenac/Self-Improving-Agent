#!/usr/bin/env bash
# QA 134 check 4 (R179-4): walk ALL SEVEN steps of the round-2 handoff's section 6 checklist, as a stranger would, in
# scratch. "GitHub" is a scratch repo O (master = origin/master 36a33bc, plus loop/t179-r2); the MAIN checkout M is a
# clone of O; the seats are worktrees of M; HOME/USERPROFILE and every store are scratch, so setup.mjs writes nothing
# real. OLD server = master aae0dce's build (src identical to 36a33bc); NEW = M's build after the merge. No push anywhere.
# usage: c7r2-walk.sh <qa134-dir> <sia-qa-repo>
set -u
export MSYS_NO_PATHCONV=1
Q="$1"; REPO="$2"; S="$Q/c7"; rm -rf "$S"; mkdir -p "$S/home/.claude" "$S/home/.cursor" "$S/store/vault"
export HOME="$S/home" USERPROFILE="$S/home" OPEN_BRAIN_VAULT_DIR="$S/store/vault" KNOWLEDGE_V2_DB="$S/store/k.db" \
  OPEN_BRAIN_ACTIVE_SESSION="$S/store/as.json" OPEN_BRAIN_SCORE_HISTORY="$S/store/score.jsonl" OPEN_BRAIN_SHADOW_LOG="$S/store/shadow.jsonl"
HD=$(node -e 'console.log(require("os").homedir().replace(/\\/g,"/"))')
case "$HD" in "$S/home"|"$(cygpath -m "$S/home" 2>/dev/null)") echo "guard: os.homedir() = $HD (scratch)";; *) echo "guard FAILED: os.homedir() = $HD, not scratch; stopping"; exit 1;; esac
G() { git -c user.name=qa134 -c user.email=qa134@x "$@"; }
recof() { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("v"+s.schema_version+" rev "+s.revision)' "$1/.agents/state.json"; }
OLD="$Q/base"
probe() { # probe <label> <build-root> <project>
  node --input-type=module -e '
const [, label, build, proj] = process.argv;
const m = await import("file:///" + build.replaceAll("\\","/") + "/open-brain/build/server.js");
const st = await m.handleStart({ project_root: proj });
const t = st.content.map((c) => c.text).join("\n");
const hit = t.split("\n").filter((l) => /schema|migrat|refus|NEWER|OLDER|rev(ision)? \d+/i.test(l)).slice(0, 2).map((l) => l.slice(0, 200));
const rev = JSON.parse((await import("node:fs")).readFileSync(proj + "/.agents/state.json", "utf8")).revision;
await m.handleSetSession({ session_id: "c7c7c7c7-0000-4000-8000-000000000134", project_dir: proj });
const w = await m.handleState({ project_root: proj, session: 134, expected_revision: rev, dry_run: true, ops: [{ op: "add_gap", what: "c7", evidence: "c7", recommended_update: "c7" }] });
console.log(`${label}\n   ob_start: ${st.isError ? "isError " : ""}${t.length} chars; ${hit.join(" | ") || "(no schema line)"}\n   ob_state dry run: ${w.content[0].text.split("\n").slice(0, 2).join(" / ").slice(0, 300)}`);
' "$1" "$2" "$3" < /dev/null 2>&1 | grep -v ExperimentalWarning
}
sync_check() { # sync_check <tree> <label>
  (cd "$1" && node open-brain/build/cli.js sync --check > "$S/sync-$2.out" 2>&1; echo "   sync --check ($2) exit=$?")
  grep -E "passed|issue" "$S/sync-$2.out" | tail -n 1 | sed 's/^/   /'
  grep -E "\[(issue|fail|warn)" "$S/sync-$2.out" | cut -c1-230 | sed 's/^/     /'
}

# "GitHub"
O="$S/origin"; git init -q -b scratch-unborn "$O"
git -C "$O" fetch -q "$REPO" refs/remotes/origin/master:refs/heads/master refs/remotes/origin/loop/t179-r2:refs/heads/loop/t179-r2
git -C "$O" checkout -q master
echo "O master $(git -C "$O" rev-parse --short master), loop/t179-r2 $(git -C "$O" rev-parse --short loop/t179-r2)"
# The main checkout and two seats, as they stand before the merge.
M="$S/main"; git clone -q "$O" "$M"
[ -f "$M/.agents/state.json" ] || { echo "SETUP FAILED: main checkout has no record; stopping"; exit 1; }
echo "main checkout at $(git -C "$M" rev-parse --short HEAD), record $(recof "$M")"
G -C "$M" worktree add -q --detach "$S/seat-detached" origin/master
G -C "$M" worktree add -q -b loop/seat-work "$S/seat-branch" origin/master
echo "seat note" > "$S/seat-branch/docs/loops/seat-note.md"; G -C "$S/seat-branch" add -A; G -C "$S/seat-branch" commit -qm "seat work (docs only)"
G -C "$M" worktree add -q -b loop/seat-wrote-state "$S/seat-state" origin/master
# A seat that wrote the record on its branch with the OLD server before the merge (every seat writes state as it works).
node --input-type=module -e '
const m = await import("file:///" + process.argv[1].replaceAll("\\","/") + "/open-brain/build/server.js");
const root = process.argv[2]; const rev = JSON.parse((await import("node:fs")).readFileSync(root + "/.agents/state.json", "utf8")).revision;
await m.handleSetSession({ session_id: "5ea75ea7-0000-4000-8000-000000000134", project_dir: root });
const r = await m.handleState({ project_root: root, session: 134, expected_revision: rev, ops: [{ op: "add_gap", what: "seat gap written on its branch before the merge", evidence: "c7", recommended_update: "c7" }] });
console.log("seat-state OLD write: " + r.content[0].text.split("\n").slice(0, 2).join(" / "));
' "$OLD" "$S/seat-state" < /dev/null 2>&1 | grep -v ExperimentalWarning
G -C "$S/seat-state" commit -qam "seat: state write on its branch (OLD server, v2)"
# Other projects on this machine on SIA with a v2 record: A2A-Hub (a read-only clone) and the v2 template (frogger's shape).
git clone -q --shared "$Q/a2a" "$S/a2a-hub"
mkdir -p "$S/frogger"; git -C "$REPO" archive aae0dce project-template | tar -x -C "$S/frogger" --strip-components=1
(cd "$S/frogger" && git init -q && G add -A && G commit -qm frogger)
echo "A2A-Hub record $(recof "$S/a2a-hub"); frogger stand-in record $(recof "$S/frogger")"

echo; echo "== 0. before: OLD server on main (v2)"; probe "OLD on main" "$OLD" "$M"
echo; echo "== merge on GitHub (Aaron's act): loop/t179-r2 into master"
G -C "$O" merge -q --no-ff -m "Merge loop/t179-r2 (scratch)" loop/t179-r2 && echo "   O master now $(git -C "$O" rev-parse --short master)"

echo; echo "== STEP 1: rebuild the main checkout: git pull, then cd open-brain && npm ci && npm run build. Do NOT reconnect."
G -C "$M" pull -q && echo "   pulled: main at $(git -C "$M" rev-parse --short HEAD), record $(recof "$M")"
(cd "$M/open-brain" && npm ci > "$S/npmci.out" 2>&1 && npm run build > "$S/build.out" 2>&1; echo "   npm ci + build exit=$?"); tail -n 1 "$S/build.out" | sed 's/^/   /'
probe "   a session still on the OLD server (not reconnected), main v2" "$OLD" "$M"
probe "   a NEW session (NEW build) between steps 1 and 2, main v2" "$M" "$M"

echo; echo "== STEP 2: migrate the live record and re-render its views, in ONE commit"
(cd "$M" && node open-brain/build/cli.js state migrate --dry-run .agents/state.json; echo "   dry-run exit=$?")
(cd "$M" && node open-brain/build/cli.js state migrate .agents/state.json > /dev/null; echo "   migrate exit=$?")
(cd "$M" && node open-brain/build/cli.js sync > "$S/sync-plain.out" 2>&1; echo "   plain sync exit=$?"); grep -E "summary-version" "$S/sync-plain.out" | cut -c1-160 | sed 's/^/   /'
echo "   changed: $(git -C "$M" status --porcelain | tr '\n' ' ')"
G -C "$M" checkout -q -b docs/state-v3-migration && G -C "$M" add .agents/state.json .agents/TASKS/INBOX.md .agents/TASKS/task.md .agents/SESSIONS/next-session.md .agents/SYSTEM/SUMMARY.md && G -C "$M" commit -qm "state: migrate the record to schema v3, views re-rendered"
echo "   left uncommitted after the commit: $(git -C "$M" status --porcelain | wc -l) path(s)"
G -C "$O" fetch -q "$M" docs/state-v3-migration && G -C "$O" merge -q --no-ff -m "Merge docs/state-v3-migration (scratch)" FETCH_HEAD && echo "   merged on GitHub: O master $(git -C "$O" rev-parse --short master)"
G -C "$M" checkout -q master && G -C "$M" pull -q && echo "   main at $(git -C "$M" rev-parse --short HEAD), record $(recof "$M")"
sync_check "$M" after-step2

echo; echo "== STEP 3: reconnect: a greeting from the NEW server shows the v3 record"
probe "   NEW on main (v3)" "$M" "$M"
probe "   OLD (a session not reconnected) on main (v3)" "$OLD" "$M"

echo; echo "== STEPS 4 and 5: node scripts/setup.mjs in the MAIN checkout (end.md + SessionEnd hook; it also rebuilds)"
# The machine was set up before: SessionStart registered from main, an unrelated SessionEnd hook of another tool present.
node -e '
const p=require("path"); const b=p.join(process.argv[1],"open-brain","build");
const s={hooks:{SessionStart:[{matcher:"",hooks:[{type:"command",command:`node "${p.join(b,"cli-bootstrap.js")}"`}]}],SessionEnd:[{matcher:"",hooks:[{type:"command",command:"node other-tool-end.js"}]}]},theme:"dark"};
require("fs").writeFileSync(p.join(process.argv[2],".claude","settings.json"),JSON.stringify(s,null,2)+"\n");' "$M" "$HOME"
(cd "$M" && node scripts/setup.mjs > "$S/setup1.out" 2>&1; echo "   setup (1st) exit=$?"); grep -iE "hook|registered|fail|error|built|build" "$S/setup1.out" | sed 's/^/   /'
node -e 'const s=require(process.argv[1]);for(const [e,v] of Object.entries(s.hooks))console.log("   settings "+e+": "+v.flatMap(x=>x.hooks.map(h=>h.command)).join(" ; "));console.log("   theme kept: "+(s.theme==="dark"))' "$HOME/.claude/settings.json"
H1=$(sha256sum "$HOME/.claude/settings.json" | cut -c1-16)
(cd "$M" && node scripts/setup.mjs > "$S/setup2.out" 2>&1; echo "   setup (2nd, re-run) exit=$?"); grep -iE "hook" "$S/setup2.out" | sed 's/^/   /'
echo "   settings.json unchanged by the re-run: $([ "$H1" = "$(sha256sum "$HOME/.claude/settings.json" | cut -c1-16)" ] && echo yes || echo NO)"
printf '   ~/.claude/commands/end.md == main .claude/commands/end.md: '; cmp -s "$HOME/.claude/commands/end.md" "$M/.claude/commands/end.md" && echo yes || echo NO
printf '   ~/.cursor/commands/end.md == main project-template/.cursor/commands/end.md: '; cmp -s "$HOME/.cursor/commands/end.md" "$M/project-template/.cursor/commands/end.md" && echo yes || echo NO
echo "   the registered SessionEnd hook runs (NOT RUN expected without a transcript; exit code is what matters):"
echo '{"session_id":"c7c7c7c7-0000-4000-8000-000000000134","cwd":"'"$M"'","hook_event_name":"SessionEnd","reason":"clear"}' | (cd "$M" && node open-brain/build/cli-session-end.js > "$S/sessionend.out" 2>&1; echo "     cli-session-end exit=$?"); head -c 400 "$S/sessionend.out" | sed 's/^/     /'; echo
sync_check "$M" after-step5

echo; echo "== STEP 6: seat worktrees (created before the merge)"
echo "   seat-detached record $(recof "$S/seat-detached"); has its own build: $([ -f "$S/seat-detached/open-brain/build/cli.js" ] && echo yes || echo no)"
(cd "$S/seat-detached" && node open-brain/build/cli.js detach > "$S/detach-own.out" 2>&1; echo "   'node open-brain/build/cli.js detach' in the seat, as written: exit=$?"); head -n 3 "$S/detach-own.out" | cut -c1-200 | sed 's/^/     /'
(cd "$S/seat-detached" && node "$M/open-brain/build/cli.js" detach > "$S/detach-main.out" 2>&1; echo "   the MAIN checkout's cli.js detach, run in the seat: exit=$?"); head -n 8 "$S/detach-main.out" | cut -c1-200 | sed 's/^/     /'
echo "   seat-detached now at $(git -C "$S/seat-detached" rev-parse --short HEAD), record $(recof "$S/seat-detached")"
probe "   NEW on seat-detached" "$M" "$S/seat-detached"
(cd "$S/seat-branch" && G fetch -q && G merge -q --no-edit origin/master > "$S/merge-seat-branch.out" 2>&1; echo "   seat on a working branch (docs only) merges origin/master: exit=$?"); echo "   seat-branch record $(recof "$S/seat-branch")"
probe "   NEW on seat-branch" "$M" "$S/seat-branch"
(cd "$S/seat-state" && G fetch -q && G merge --no-edit origin/master > "$S/merge-seat-state.out" 2>&1; echo "   seat that WROTE its record on its branch (v2) merges origin/master: exit=$?"); cut -c1-200 "$S/merge-seat-state.out" | sed 's/^/     /'
echo "   seat-state: status $(git -C "$S/seat-state" status --porcelain | tr '\n' ' ')"
(cd "$S/seat-state" && G merge --abort 2>/dev/null; true)

echo; echo "== STEP 7: other projects on this machine with a v2 record"
for P in a2a-hub frogger; do
  probe "   NEW on $P before migrating" "$M" "$S/$P"
  (cd "$S/$P" && node "$M/open-brain/build/cli.js" state migrate --dry-run .agents/state.json | head -n 12 | sed 's/^/     /'; node "$M/open-brain/build/cli.js" state migrate .agents/state.json > /dev/null; echo "   $P migrate exit=$?")
  echo "   $P record $(recof "$S/$P"); changed: $(git -C "$S/$P" status --porcelain | tr '\n' ' ')"
  probe "   NEW on $P after migrating" "$M" "$S/$P"
  (cd "$S/$P" && node "$M/open-brain/build/cli.js" sync --check > "$S/sync-$P.out" 2>&1; echo "   $P sync --check (MAIN's cli) exit=$?"); grep -E "summary-version|state-views" "$S/sync-$P.out" | cut -c1-220 | sed 's/^/     /'
done
echo; echo "walk done"
