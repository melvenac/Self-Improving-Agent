#!/usr/bin/env bash
# QA 134 check 4 (R179-4 step 2 and step 7): the v2 -> v3 migration of candidate 1646567 on COPIES of real records.
# Adapted from QA 125's c2-migrate.sh. Each spec is label|repo|commit|record: a --shared clone of <repo> detached at
# <commit>; if <record> is non-empty it replaces .agents/state.json (committed first). Nothing outside scratch is written.
# Instrument A: the migration's own report. Instrument B: an independent count of every uuid-shaped string in the bytes
# (grep -o) plus a JSON walk listing each uuid with its path. Run twice (idempotence by sha256), field-by-field compare,
# then the plain `sync` (re-render) and one ob_state write through the server handler with a registered session.
# usage: c2r2-migrate.sh <cand-root> <scratch-dir> <spec>...
set -u
export MSYS_NO_PATHCONV=1
CAND="$1"; S="$2"; shift 2
CLI="$CAND/open-brain/build/cli.js"
RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
walk() { node -e '
const t=require("fs").readFileSync(process.argv[1],"utf8"); const re=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const out=[]; (function w(v,p){ if(typeof v==="string"){ for(const u of (v.match(re)||[])) out.push(p+"="+u.toLowerCase());} else if(v&&typeof v==="object") for(const k of Object.keys(v)) w(v[k],p+"."+k); })(JSON.parse(t),"$");
console.log(out.sort().join("\n"));' "$1"; }
for SPEC in "$@"; do
  IFS='|' read -r N REPO COMMIT REC <<< "$SPEC"
  D="$S/c2-$N"; rm -rf "$D"
  git clone -q --shared "$REPO" "$D" && git -C "$D" checkout -q --detach "$COMMIT"
  if [ -n "$REC" ]; then cp "$REC" "$D/.agents/state.json"; (cd "$D" && git -c user.name=qa134 -c user.email=qa134@x commit -qam "scratch: this record" || true); fi
  cp "$D/.agents/state.json" "$D/../c2-$N.before.json"
  echo "=== $N ($REPO @ $COMMIT${REC:+, record $(basename "$REC")}) sha256 $(sha256sum "$D/.agents/state.json" | cut -c1-16)"
  echo "B before: occurrences=$(grep -oE "$RE" "$D/.agents/state.json" | wc -l) distinct=$(grep -oE "$RE" "$D/.agents/state.json" | tr A-F a-f | sort -u | wc -l)"
  walk "$D/.agents/state.json" > "$D/../c2-$N.walk-before.txt"; echo "B before, by path:"; sed 's/^/  /' "$D/../c2-$N.walk-before.txt"
  (cd "$D" && node "$CLI" state migrate --dry-run .agents/state.json); echo "dry-run exit=$?"
  echo "after dry-run file unchanged: $(cmp -s "$D/.agents/state.json" "$D/../c2-$N.before.json" && echo yes || echo NO)"
  (cd "$D" && node "$CLI" state migrate .agents/state.json); echo "run1 exit=$?"
  echo "files changed by run1: $(git -C "$D" status --porcelain | tr '\n' ' ')"
  H1=$(sha256sum "$D/.agents/state.json" | cut -d' ' -f1)
  echo "B after: occurrences=$(grep -oE "$RE" "$D/.agents/state.json" | wc -l) distinct=$(grep -oE "$RE" "$D/.agents/state.json" | tr A-F a-f | sort -u | wc -l)"
  walk "$D/.agents/state.json" > "$D/../c2-$N.walk-after.txt"; echo "B after, by path:"; sed 's/^/  /' "$D/../c2-$N.walk-after.txt"
  echo "distinct uuid sets equal: $(diff <(sed 's/.*=//' "$D/../c2-$N.walk-before.txt" | sort -u) <(sed 's/.*=//' "$D/../c2-$N.walk-after.txt" | sort -u) >/dev/null && echo yes || echo NO)"
  (cd "$D" && node "$CLI" state migrate .agents/state.json); echo "run2 exit=$?"
  H2=$(sha256sum "$D/.agents/state.json" | cut -d' ' -f1)
  echo "idempotent (sha after run1 == after run2): $([ "$H1" = "$H2" ] && echo yes || echo NO) ${H1:0:16}"
  node -e '
const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")), b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8"));
const moved=new Set(["schema_version","revision","handoffs","last_session","sessions","tasks"]);
const keys=[...new Set([...Object.keys(a),...Object.keys(b)])]; const diff=keys.filter(k=>!moved.has(k)&&JSON.stringify(a[k])!==JSON.stringify(b[k]));
console.log("schema", a.schema_version, "->", b.schema_version, "; revision", a.revision, "->", b.revision);
console.log("unmoved fields differing:", diff.length?diff.join(","):"none");
const stripT=t=>{const {closed_rev,...r}=t;return JSON.stringify(r)};
console.log("tasks: same count", a.tasks.length===b.tasks.length, "; each word-for-word + closed_rev:null:", a.tasks.every((t,i)=>JSON.stringify(t)===stripT(b.tasks[i])&&b.tasks[i].closed_rev===null), "; done:", b.tasks.filter(t=>t.status==="done").length);
const strip=h=>{const {session_uuid,checkout,first_rev,...r}=h;return JSON.stringify(r)};
console.log("handoffs:", a.handoffs.length, "->", b.handoffs.length, "; word-for-word:", a.handoffs.every((h,i)=>JSON.stringify(h)===strip(b.handoffs[i])), "; new keys null:", b.handoffs.every(h=>h.session_uuid===null&&h.checkout===null&&h.first_rev===null));
const {checkout,first_rev,...s0}=b.sessions[0]; console.log("last_session == sessions[0] minus checkout/first_rev (both null):", JSON.stringify(a.last_session)===JSON.stringify(s0), checkout===null&&first_rev===null, "; sessions.length", b.sessions.length);
' "$D/../c2-$N.before.json" "$D/.agents/state.json"
  (cd "$D" && node "$CLI" sync > "$D/../c2-$N.sync.out" 2>&1; echo "plain sync exit=$?"); grep -iE "summary-version|re-render" "$D/../c2-$N.sync.out" | head -3 | sed 's/^/  /'
  echo "files changed after migrate+sync: $(git -C "$D" status --porcelain | tr '\n' ' ')"
  (cd "$D" && git -c user.name=qa134 -c user.email=qa134@x commit -qam migrated)
  (cd "$D" && node "$CLI" sync --check > "$D/../c2-$N.sync-check.out" 2>&1; echo "sync --check exit=$?"); grep -E "summary-version|state-schema|record-erasure|state-views" "$D/../c2-$N.sync-check.out" | head -6 | sed 's/^/  /'
  REV=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).revision)' "$D/.agents/state.json")
  mkdir -p "$D/../c2-$N.store"; ST="$D/../c2-$N.store"
  KNOWLEDGE_V2_DB="$ST/k.db" OPEN_BRAIN_ACTIVE_SESSION="$ST/as.json" OPEN_BRAIN_VAULT_DIR="$ST/vault" \
  OPEN_BRAIN_SCORE_HISTORY="$ST/score.jsonl" OPEN_BRAIN_SHADOW_LOG="$ST/shadow.jsonl" \
  node --input-type=module -e '
const m = await import(process.argv[1]);
const root = process.argv[2], rev = Number(process.argv[3]);
const s = await m.handleSetSession({ session_id: "aa134000-0000-4000-8000-000000000134", project_dir: root });
console.log("set_session:", s.content[0].text.split("\n")[0]);
const r = await m.handleState({ project_root: root, session: 134, expected_revision: rev, ops: [
  { op: "set_handoff", seat: "qa", pick_up: "QA 134 probe", watch_out: [], open_questions: [] },
  { op: "add_gap", what: "QA 134 probe gap", evidence: "probe", recommended_update: "none" } ] });
console.log(r.content[0].text.split("\n").map(l=>"  "+l).join("\n"));
' "file:///$CAND/open-brain/build/server.js" "$D" "$REV" < /dev/null 2>&1 | grep -v ExperimentalWarning
  node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("after write: schema",s.schema_version,"rev",s.revision,"\n  handoffs",s.handoffs.map(h=>h.seat+"@"+h.session+":"+(h.session_uuid||"legacy")+":fr="+h.first_rev).join(", "),"\n  sessions",s.sessions.map(x=>x.n+":"+(x.uuid||"null")+":"+x.seat+":"+x.checkout+":fr="+x.first_rev).join(", "))' "$D/.agents/state.json"
  echo "B after write: distinct=$(grep -oE "$RE" "$D/.agents/state.json" | tr A-F a-f | sort -u | wc -l)"
done
