#!/usr/bin/env bash
# QA 125 check 2: the v2 -> v3 migration on COPIES of this repository's live record (rev 132 and master's rev 131).
# Instrument A: the migration's own report. Instrument B: an independent count of every uuid-shaped string in the
# bytes (grep -o, not the migration's regex code), plus a JSON walk listing every string field holding a uuid, with its path.
# Runs the migration twice (idempotence: byte-identical file, same sha256), then one ob_state write on the migrated copy.
# usage: c2-migrate.sh <cand-root> <scratch-dir> <record.json>...
set -u
export MSYS_NO_PATHCONV=1
CAND="$1"; S="$2"; shift 2
CLI="$CAND/open-brain/build/cli.js"
walk() { node -e '
const t=require("fs").readFileSync(process.argv[1],"utf8"); const re=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const out=[]; (function w(v,p){ if(typeof v==="string"){ for(const u of (v.match(new RegExp(re.source,"gi"))||[])) out.push(p+"="+u.toLowerCase());} else if(v&&typeof v==="object") for(const k of Object.keys(v)) w(v[k],p+"."+k); })(JSON.parse(t),"$");
console.log(out.sort().join("\n"));' "$1"; }
for REC in "$@"; do
  N=$(basename "$REC" .json); D="$S/c2-$N"; rm -rf "$D"
  git clone -q --shared "$CAND" "$D" && git -C "$D" checkout -q --detach 3c0bfdc
  cp "$REC" "$D/.agents/state.json"
  (cd "$D" && git -c user.name=qa -c user.email=qa@x commit -qam "scratch: this record" || true)
  echo "=== $N"
  echo "B before: occurrences=$(grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$D/.agents/state.json" | wc -l) distinct=$(grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$D/.agents/state.json" | tr A-F a-f | sort -u | wc -l)"
  walk "$D/.agents/state.json" > "$D/walk-before.txt"; echo "B before, by path:"; sed 's/^/  /' "$D/walk-before.txt"
  (cd "$D" && node "$CLI" state migrate --dry-run .agents/state.json); echo "dry-run exit=$?"
  sha256sum "$D/.agents/state.json" | cut -c1-16 | sed 's/^/after dry-run sha: /'
  (cd "$D" && node "$CLI" state migrate .agents/state.json); echo "run1 exit=$?"
  H1=$(sha256sum "$D/.agents/state.json" | cut -d' ' -f1)
  echo "B after: occurrences=$(grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$D/.agents/state.json" | wc -l) distinct=$(grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$D/.agents/state.json" | tr A-F a-f | sort -u | wc -l)"
  walk "$D/.agents/state.json" > "$D/walk-after.txt"; echo "B after, by path:"; sed 's/^/  /' "$D/walk-after.txt"
  echo "distinct uuid sets equal: $(diff <(sed 's/.*=//' "$D/walk-before.txt" | sort -u) <(sed 's/.*=//' "$D/walk-after.txt" | sort -u) >/dev/null && echo yes || echo NO)"
  (cd "$D" && node "$CLI" state migrate .agents/state.json); echo "run2 exit=$?"
  H2=$(sha256sum "$D/.agents/state.json" | cut -d' ' -f1)
  echo "idempotent (sha after run1 == after run2): $([ "$H1" = "$H2" ] && echo yes || echo NO) $H1"
  # Field-by-field: everything except the five fields the migration names must be byte-identical.
  node -e '
const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")), b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8"));
const moved=new Set(["schema_version","revision","handoffs","last_session","sessions"]);
const keys=[...new Set([...Object.keys(a),...Object.keys(b)])]; const diff=keys.filter(k=>!moved.has(k)&&JSON.stringify(a[k])!==JSON.stringify(b[k]));
console.log("unmoved fields differing:", diff.length?diff.join(","):"none");
const strip=h=>{const {session_uuid,checkout,...r}=h;return JSON.stringify(r)};
console.log("handoffs word-for-word:", a.handoffs.length===b.handoffs.length && a.handoffs.every((h,i)=>JSON.stringify(h)===strip(b.handoffs[i])) ? "yes":"NO", "; new keys null:", b.handoffs.every(h=>h.session_uuid===null&&h.checkout===null));
const {checkout,...s0}=b.sessions[0]; console.log("last_session == sessions[0] minus checkout:", JSON.stringify(a.last_session)===JSON.stringify(s0), "sessions.length", b.sessions.length);
' "$REC" "$D/.agents/state.json"
  (cd "$D" && git -c user.name=qa -c user.email=qa@x commit -qam migrated)
  # One ob_state write on the migrated copy, through the server handler with a registered session.
  REV=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).revision)' "$D/.agents/state.json")
  mkdir -p "$D/store"
  KNOWLEDGE_V2_DB="$D/store/k.db" OPEN_BRAIN_ACTIVE_SESSION="$D/store/as.json" OPEN_BRAIN_VAULT_DIR="$D/store/vault" \
  OPEN_BRAIN_SCORE_HISTORY="$D/store/score.jsonl" OPEN_BRAIN_SHADOW_LOG="$D/store/shadow.jsonl" \
  node --input-type=module -e '
const m = await import(process.argv[1]);
const root = process.argv[2], rev = Number(process.argv[3]);
const s = await m.handleSetSession({ session_id: "aa125000-0000-4000-8000-000000000125", project_dir: root });
console.log("set_session:", s.content[0].text.split("\n")[0]);
const r = await m.handleState({ project_root: root, session: 125, expected_revision: rev, ops: [
  { op: "set_handoff", seat: "qa", pick_up: "QA 125 probe", watch_out: [], open_questions: [] },
  { op: "add_gap", what: "QA 125 probe gap", evidence: "probe", recommended_update: "none" } ] });
console.log(r.content[0].text);
' "file:///$CAND/open-brain/build/server.js" "$D" "$REV"
  node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("after write: schema",s.schema_version,"rev",s.revision,"handoffs",s.handoffs.map(h=>h.seat+"@"+h.session+":"+(h.session_uuid||"legacy")).join(", "),"sessions",s.sessions.map(x=>x.n+":"+(x.uuid||"null")+":"+x.seat+":"+x.checkout).join(", "))' "$D/.agents/state.json"
  echo "B after write: distinct=$(grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$D/.agents/state.json" | tr A-F a-f | sort -u | wc -l)"
done
