#!/usr/bin/env bash
# QA 125 check 7: walk T-179 handoff section 7 (after merge) in a scratch clone, as a stranger would, with a scratch
# HOME so setup.mjs writes nothing real. Nothing is pushed. usage: c7-walk.sh <scratch-dir>
# OLD server = master aae0dce's build (C:/qa-scratch/qa125/base); NEW = the merged scratch main tree's build.
set -u
export MSYS_NO_PATHCONV=1
Q="$1"; S="$Q/c7"; rm -rf "$S"; mkdir -p "$S/home/.claude" "$S/home/.cursor" "$S/store/vault"
export HOME="$S/home" USERPROFILE="$S/home" OPEN_BRAIN_VAULT_DIR="$S/store/vault" KNOWLEDGE_V2_DB="$S/store/k.db" \
  OPEN_BRAIN_ACTIVE_SESSION="$S/store/as.json" OPEN_BRAIN_SCORE_HISTORY="$S/store/score.jsonl" OPEN_BRAIN_SHADOW_LOG="$S/store/shadow.jsonl"
G() { git -c user.name=qa125 -c user.email=qa125@x "$@"; }
M="$S/main"
git clone -q "$Q/full" "$M"; git -C "$M" checkout -q --detach refs/remotes/origin/master
echo "main tree at $(git -C "$M" rev-parse --short HEAD), record: $(node -e 'const s=require(process.argv[1]);console.log("v"+s.schema_version+" rev "+s.revision)' "$M/.agents/state.json")"
# A second project on this machine that uses SIA (the template at master: a v2 record).
cp -r "$M/project-template" "$S/other"; (cd "$S/other" && git init -q && G add -A && G commit -qm other)

probe() { # probe <label> <build-root> <project>
  node --input-type=module -e '
const [, label, build, proj] = process.argv;
const m = await import("file:///" + build.replaceAll("\\","/") + "/open-brain/build/server.js");
const st = await m.handleStart({ project_root: proj });
const t = st.content.map((c) => c.text).join("\n");
const hit = t.split("\n").filter((l) => /schema|migrate|refus|NEWER|OLDER|## State/i.test(l)).slice(0, 3).map((l) => l.slice(0, 220));
const rev = JSON.parse((await import("node:fs")).readFileSync(proj + "/.agents/state.json", "utf8")).revision;
await m.handleSetSession({ session_id: "c7c7c7c7-0000-4000-8000-000000000125", project_dir: proj });
const w = await m.handleState({ project_root: proj, session: 125, expected_revision: rev, dry_run: true, ops: [{ op: "add_gap", what: "c7", evidence: "c7", recommended_update: "c7" }] });
console.log(`${label}\n   ob_start: ${st.isError ? "isError " : ""}${t.length} chars; ${hit.join(" | ") || "(no schema line)"}\n   ob_state dry run: ${w.content[0].text.split("\n").slice(0, 2).join(" / ").slice(0, 400)}`);
' "$1" "$2" "$3" 2>&1 | grep -v ExperimentalWarning
}

echo; echo "== 0. before the merge: OLD server on the v2 record"; probe "OLD on main (v2)" "$Q/base" "$M"
echo "   /sync --check with the OLD build on master (baseline):"; (cd "$M" && node "$Q/base/open-brain/build/cli.js" sync --check > "$S/sync0.out" 2>&1); grep -E "greeting-size|Summary" "$S/sync0.out" | head -3 | sed "s/^/   /"
echo; echo "== 1a. merge (Aaron's act; scratch here)"
G -C "$M" merge -q --no-ff -m "scratch merge of loop/t179-merge 3c0bfdc" 3c0bfdc && echo "merged: $(git -C "$M" rev-parse --short HEAD)"
echo "record after the merge: $(node -e 'const s=require(process.argv[1]);console.log("v"+s.schema_version+" rev "+s.revision)' "$M/.agents/state.json")"
echo; echo "== 1b. between merge and rebuild: the OLD server still running (no reconnect yet)"; probe "OLD on merged main (v2 record)" "$Q/base" "$M"
echo; echo "== 1c. rebuild, as a stranger would: node scripts/setup.mjs (builds, registers, copies commands) under the scratch HOME"
(cd "$M" && node scripts/setup.mjs > "$S/setup.out" 2>&1; echo "setup exit=$?"); grep -v "^$" "$S/setup.out" | sed 's/^/   /' | head -30
echo; echo "== 1d. NEW server, record not yet migrated (the window between steps 1 and 2)"
probe "NEW on main (v2 record)" "$M" "$M"
probe "NEW on another SIA project (v2 record), which section 7 does not mention" "$M" "$S/other"
echo; echo "== 2. migrate: dry run, then real, then commit"
(cd "$M" && node open-brain/build/cli.js state migrate --dry-run .agents/state.json; node open-brain/build/cli.js state migrate .agents/state.json; G commit -qam "state: migrate the record to schema v3" && echo "committed $(git rev-parse --short HEAD)")
probe "NEW on main (v3)" "$M" "$M"
probe "OLD (a seat that did not rebuild/reconnect) on main (v3)" "$Q/base" "$M"
echo; echo "== 3. installed commands (scratch HOME) vs the merged tree"
for f in end.md sync.md; do
  printf '   ~/.claude/commands/%s == project-template/.claude/commands/%s: ' $f $f; cmp -s "$HOME/.claude/commands/$f" "$M/project-template/.claude/commands/$f" && echo yes || echo NO
  printf '   ~/.cursor/commands/%s == project-template/.cursor/commands/%s: ' $f $f; cmp -s "$HOME/.cursor/commands/$f" "$M/project-template/.cursor/commands/$f" && echo yes || echo NO
done
printf '   .claude/commands/end.md (the repo copy) == installed: '; cmp -s "$M/.claude/commands/end.md" "$HOME/.claude/commands/end.md" && echo yes || echo NO
echo; echo "== 4. /sync --check on the migrated main tree with the installed commands"
(cd "$M" && node open-brain/build/cli.js sync --check > "$S/sync.out" 2>&1; echo "   sync exit=$?"); grep -E "passed|warning|issue|ISSUE|FAIL|✗|state-schema|mirror-parity|command-parity|record-erasure|retirements" "$S/sync.out" | head -20 | sed 's/^/   /'
