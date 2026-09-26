#!/usr/bin/env bash
# QA 125: the label cost, independently. Same scratch tree (c1-proj's clone), same seat files; master aae0dce's build
# on the v2 record (rev 132) vs the candidate's build on the same record migrated to v3 (rev 133). usage: c9b-label.sh <scratch>
set -u; export MSYS_NO_PATHCONV=1
Q="$1"; P="$Q/c9b-proj"; rm -rf "$P"; git clone -q --shared "$Q/c1-proj" "$P" 2>/dev/null
export KNOWLEDGE_V2_DB="$Q/c9b-store/k.db" OPEN_BRAIN_ACTIVE_SESSION="$Q/c9b-store/as.json" OPEN_BRAIN_VAULT_DIR="$Q/c9b-store/vault" OPEN_BRAIN_SCORE_HISTORY="$Q/c9b-store/s.jsonl" OPEN_BRAIN_SHADOW_LOG="$Q/c9b-store/sh.jsonl"
mkdir -p "$Q/c9b-store/vault"
g() { node --input-type=module -e '
const m = await import("file:///" + process.argv[1] + "/open-brain/build/server.js");
const r = await m.handleStart({ project_root: process.argv[2] });
const t = r.content.map((c) => c.text).join("\n"); (await import("node:fs")).writeFileSync(process.argv[3], t); console.log(t.length);' "$1" "$P" "$2"; }
for seat in planner developer qa; do
  printf -- "---\nname: Seat\nrole: %s\npartner: Atlas\n---\n" "$seat" > "$P/.agents/AGENT.local.md"
  cp "$Q/live-rev132.json" "$P/.agents/state.json"; rm -f "$P"/.agents/SESSIONS/Session_*.md
  B=$(g "$Q/base" "$Q/c9b-$seat-before.txt")
  (cd "$P" && node "$Q/cand/open-brain/build/cli.js" state migrate .agents/state.json >/dev/null); rm -f "$P"/.agents/SESSIONS/Session_*.md
  A=$(g "$Q/cand" "$Q/c9b-$seat-after.txt")
  echo "$seat: before $B, after $A, delta $((A-B))"
  diff "$Q/c9b-$seat-before.txt" "$Q/c9b-$seat-after.txt" | grep '^[<>]' | cut -c1-150 | sed 's/^/    /'
done
