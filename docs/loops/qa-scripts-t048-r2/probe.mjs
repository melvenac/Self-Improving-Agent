// QA 157 real-input probes for T-048 r2. Runs the BUILT code of one tree (base 1646567 or cand 5b9a403).
// Usage: node probe.mjs <label> <openBrainDir> <scratchRoot> [case ...]
// Each case runs in a CHILD process whose HOME/USERPROFILE/KNOWLEDGE_V2_DB/OPEN_BRAIN_VAULT_DIR point into
// <scratchRoot>/<label>/<case>/ (homedir() is read at module load, so the env must be set before import).
import { spawnSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const [label, ob, root, ...only] = process.argv.slice(2);
const MKCM = "C:/qa-scratch/qa157/scripts/mkcm.mjs";
const CASES = ["s5", "s16", "s16lock", "s6", "s14", "s15", "hook"];

if (process.env.QA157_CHILD) {
  await child(process.env.QA157_CHILD);
} else {
  for (const c of only.length ? only : CASES) {
    const dir = join(root, label, c);
    rmSync(dir, { recursive: true, force: true });
    const home = join(dir, "home");
    mkdirSync(join(home, ".claude", "open-brain"), { recursive: true });
    mkdirSync(join(home, "vault"), { recursive: true });
    const env = {
      ...process.env, QA157_CHILD: c, HOME: home, USERPROFILE: home,
      KNOWLEDGE_V2_DB: join(home, ".claude", "open-brain", "knowledge-v2.db"),
      OPEN_BRAIN_VAULT_DIR: join(home, "vault"), NODE_NO_WARNINGS: "1",
    };
    const r = spawnSync(process.execPath, [process.argv[1], label, ob, root], { env, encoding: "utf8" });
    console.log(`\n===== [${label}] case ${c} (child exit ${r.status}) =====`);
    process.stdout.write(r.stdout);
    if (r.stderr.trim()) process.stdout.write(`--- stderr ---\n${r.stderr}`);
  }
}

async function child(c) {
  const home = process.env.USERPROFILE;
  const B = (p) => import(pathToFileURL(join(ob, "build", p)).href);
  const req = createRequire(join(ob, "package.json"));
  const Database = req("better-sqlite3");
  const dbv2 = await B("db-v2.js");
  const se = await B("pipelines/session-end/index-v2.js");
  const fmt = (res) => (se.formatSessionEndLines ? se.formatSessionEndLines(res) : legacyLines(res));
  const sessionsDir = join(home, ".claude", "context-mode", "sessions");
  let sessionsDirV = sessionsDir;
  const mkcm = (file, sid, evs) => {
    mkdirSync(sessionsDirV, { recursive: true });
    const r = spawnSync(process.execPath, [MKCM, join(sessionsDirV, file), sid, "C:/qa-proj", evs], { encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
    if (r.status !== 0) throw new Error(`mkcm failed: ${r.stderr}`);
  };
  const seed = (db, key, tags = "typescript") => {
    dbv2.indexKnowledge(db, { vaultPath: `/vault/Experiences/qa/${key}.md`, key, tags, content: `content ${key}` });
    return db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key).id;
  };
  const counters = (db, id) => db.prepare("SELECT helpful, harmful, neutral FROM knowledge_index WHERE id = ?").get(id);
  const fbRows = (db) => { try { return db.prepare("SELECT knowledge_id, rating, rating_method FROM feedback_log ORDER BY id").all(); } catch (e) { return `THROWS ${e.code ?? ""} ${e.message}`; } };
  const run = (input) => {
    try {
      const res = se.sessionEndV2(input);
      console.log(`sessionEndV2 returned. result.summary=${JSON.stringify(res.summary)} feedback=${JSON.stringify({ ...res.feedback, ratings: undefined })}`);
      for (const l of fmt(res)) console.log(`  LINE ${l}`);
      return res;
    } catch (e) {
      console.log(`sessionEndV2 THREW: ${e.code ?? ""} ${e.message}`);
      return null;
    }
  };
  const base = (db, over) => ({
    db, vaultDir: process.env.OPEN_BRAIN_VAULT_DIR, agentsDir: join(home, "agents"), sessionId: "qa157-sess",
    sessionSummary: "Worked on typescript all day", project: "qa-proj", recalledEntryIds: [], dryRun: false, ...over,
  });

  if (c === "s5") {
    const db = dbv2.openV2Database(process.env.KNOWLEDGE_V2_DB);
    const gone = seed(db, "gone"), omitted = seed(db, "omitted"), rated = seed(db, "rated");
    dbv2.recordRecallEvent(db, "qa157-sess", "typescript", [gone, omitted, rated]);
    // the ob_forget statement (server.ts:1140), verbatim
    db.prepare("DELETE FROM knowledge_index WHERE id = ?").run(gone);
    const before = counters(db, omitted);
    console.log(`ids: gone=${gone} omitted=${omitted} rated=${rated}; omitted counters before ${JSON.stringify(before)}`);
    run(base(db, { recalledEntryIds: [gone, omitted, rated], entryRatings: { [rated]: "neutral" } }));
    console.log(`omitted counters after ${JSON.stringify(counters(db, omitted))}; rated counters ${JSON.stringify(counters(db, rated))}`);
    console.log(`feedback_log rows: ${JSON.stringify(fbRows(db))}`);
    // the helpful/neutral rule: supplied rating wins regardless of tag match
    const h = seed(db, "helpful-untagged", "zzz-no-match"), n = seed(db, "neutral-tagged", "typescript");
    run(base(db, { sessionId: "qa157-rule", recalledEntryIds: [h, n], entryRatings: { [h]: "helpful", [n]: "neutral" } }));
    console.log(`rule: helpful-untagged ${JSON.stringify(counters(db, h))} neutral-tagged ${JSON.stringify(counters(db, n))}; log ${JSON.stringify(fbRows(db).slice(-2))}`);
    db.close();
  }

  if (c === "s16") {
    for (const how of ["drop-table", "trigger-abort", "no-session-id"]) {
      rmSync(process.env.KNOWLEDGE_V2_DB, { force: true });
      const db = dbv2.openV2Database(process.env.KNOWLEDGE_V2_DB);
      const a = seed(db, "a"), b = seed(db, "b");
      if (how === "drop-table") db.exec("DROP TABLE feedback_log");
      if (how === "trigger-abort") db.exec(`CREATE TRIGGER qa_fail BEFORE INSERT ON feedback_log WHEN NEW.knowledge_id = ${a} BEGIN SELECT RAISE(ABORT, 'qa157 trigger refuses id ${a}'); END;`);
      console.log(`-- ${how}: ids a=${a} b=${b}`);
      run(base(db, { sessionId: how === "no-session-id" ? "" : "qa157-sess", recalledEntryIds: [a, b], entryRatings: { [a]: "helpful", [b]: "helpful" } }));
      console.log(`   counters a ${JSON.stringify(counters(db, a))} b ${JSON.stringify(counters(db, b))}; feedback_log ${JSON.stringify(fbRows(db))}`);
      db.close();
    }
  }

  if (c === "s16lock") {
    // A second PROCESS holds the write lock (BEGIN IMMEDIATE) on the real knowledge db file.
    const db0 = dbv2.openV2Database(process.env.KNOWLEDGE_V2_DB);
    const a = seed(db0, "a");
    db0.close();
    const holder = spawn(process.execPath, ["-e", `
      const D=require(${JSON.stringify(req.resolve("better-sqlite3"))}); const d=new D(process.argv[1]);
      d.exec("BEGIN IMMEDIATE"); console.log("LOCKED"); setTimeout(()=>{d.exec("ROLLBACK");d.close();},15000);`, process.env.KNOWLEDGE_V2_DB], { stdio: ["ignore", "pipe", "inherit"] });
    await new Promise((res) => holder.stdout.on("data", (d) => String(d).includes("LOCKED") && res()));
    const db = new Database(process.env.KNOWLEDGE_V2_DB); // same flags the hook's openV2Database gives (WAL already set); no init writes
    console.log(`-- lock held by pid ${holder.pid}; id a=${a}`);
    const t0 = Date.now();
    run(base(db, { recalledEntryIds: [a], entryRatings: { [a]: "helpful" } }));
    console.log(`   took ${Date.now() - t0} ms`);
    db.close();
    await new Promise((res) => holder.on("exit", res));
    const db2 = new Database(process.env.KNOWLEDGE_V2_DB);
    console.log(`   after release: counters a ${JSON.stringify(counters(db2, a))}; feedback_log ${JSON.stringify(fbRows(db2))}`);
    db2.close();
  }

  if (c === "s6") {
    const il = await B("pipelines/session-end/invocation-logger.js");
    const { scorePipelineHealth } = await B("pipelines/sync/scorer.js");
    const d = join(home, "logs");
    mkdirSync(d, { recursive: true });
    const p = (n) => join(d, n);
    writeFileSync(p("good.jsonl"), JSON.stringify({ ts: new Date(Date.now() - 3600e3).toISOString().replace("T", " ").slice(0, 19), type: "skill", name: "x", session: "s", project: "p" }) + "\n");
    writeFileSync(p("corrupt.jsonl"), "garbage\n{not json\n" + JSON.stringify({ noTs: true }) + "\n");
    writeFileSync(p("bad-ts.jsonl"), JSON.stringify({ ts: "not a date" }) + "\n");
    writeFileSync(p("empty.jsonl"), "");
    writeFileSync(p("mixed.jsonl"), "garbage\n" + JSON.stringify({ ts: "2026-09-20 10:00:00" }) + "\n");
    mkdirSync(p("dir.jsonl"));
    writeFileSync(p("denied.jsonl"), JSON.stringify({ ts: "2026-09-20 10:00:00" }) + "\n");
    const user = process.env.USERNAME;
    const ic = spawnSync("icacls", [p("denied.jsonl"), "/deny", `${user}:(R)`], { encoding: "utf8" });
    console.log(`icacls deny read for ${user}: exit ${ic.status}`);
    writeFileSync(p("locked.jsonl"), JSON.stringify({ ts: "2026-09-20 10:00:00" }) + "\n");
    const locker = spawn("powershell", ["-NoProfile", "-Command", `$f=[IO.File]::Open('${p("locked.jsonl")}','Open','ReadWrite','None'); 'HELD'; Start-Sleep 20; $f.Close()`], { stdio: ["ignore", "pipe", "inherit"] });
    await new Promise((res) => locker.stdout.on("data", (d) => String(d).includes("HELD") && res()));
    for (const n of ["locked.jsonl", "missing.jsonl", "good.jsonl", "corrupt.jsonl", "bad-ts.jsonl", "empty.jsonl", "mixed.jsonl", "dir.jsonl", "denied.jsonl"]) {
      let v;
      try { v = il.readLastInvocationTs(p(n)); } catch (e) { v = `THREW ${e.message}`; }
      let s;
      try { s = scorePipelineHealth({ lastHookRun: v, scoreTrend: "unknown" }); } catch (e) { s = `THREW ${e.message}`; }
      console.log(`${n.padEnd(14)} read=${JSON.stringify(v)}  health=${typeof s === "string" ? s : `score ${s.score}/10 details ${JSON.stringify(s.details)}`}`);
    }
    console.log("icacls on denied.jsonl: " + spawnSync("icacls", [p("denied.jsonl")], { encoding: "utf8" }).stdout.replace(/\s+/g, " "));
    spawnSync("icacls", [p("denied.jsonl"), "/remove:d", user], { encoding: "utf8" });
    locker.kill();
  }

  if (c === "s14" || c === "s15") {
    const variants = c === "s14" ? [
      ["garbage file + target", () => writeFileSync(join(sessionsDirV, "bad.db"), "not a sqlite database at all, just text"), "qa-target"],
      ["real db, other session + target", () => mkcm("other.db", "someone-else", "user_prompt:hi"), "qa-target"],
      ["garbage + real db FOR target", () => { writeFileSync(join(sessionsDirV, "bad.db"), "garbage"); mkcm("mine.db", "qa-target", "user_prompt:the real prompt,decision:ship it"); }, "qa-target"],
      ["real db FOR target + NEWER garbage", () => { mkcm("mine.db", "qa-target", "user_prompt:the real prompt,decision:ship it"); const g = join(sessionsDirV, "bad.db"); writeFileSync(g, "garbage"); const t = new Date(Date.now() + 60e3); utimesSync(g, t, t); }, "qa-target"],
      ["zero-byte .db + target", () => writeFileSync(join(sessionsDirV, "empty.db"), ""), "qa-target"],
      ["valid sqlite, not a session db + target", () => { const x = new Database(join(sessionsDirV, "notsession.db")); x.exec("CREATE TABLE t(a)"); x.close(); }, "qa-target"],
      ["sessions dir missing + target", () => {}, "qa-target"],
      ["real db, target in 2nd session_meta row", () => { mkcm("multi.db", "first-session", "user_prompt:a"); spawnSync(process.execPath, [MKCM, join(sessionsDirV, "multi.db"), "qa-target", "C:/qa-proj", "user_prompt:b"], { env: { ...process.env, NODE_NO_WARNINGS: "1" } }); }, "qa-target"],
    ] : [
      ["garbage file (no session id)", () => { writeFileSync(join(sessionsDirV, "bad.db"), "not a sqlite database at all, just text"); }, ""],
      ["no session_events (plain sqlite)", () => { const x = new Database(join(sessionsDirV, "s.db")); x.exec("CREATE TABLE session_meta (session_id TEXT, project_dir TEXT, started_at TEXT, last_event_at TEXT, event_count INTEGER)"); x.close(); }, ""],
      ["real context-mode db, no ensureSession (no session_meta row)", () => mkcm("s.db", "-", "none"), ""],
      ["real context-mode db, session, zero events", () => mkcm("s.db", "qa-s15", "none"), ""],
      ["real context-mode db, only non-summary events", () => mkcm("s.db", "qa-s15", "file_read:C:/x.ts"), ""],
      ["real context-mode db with events (control)", () => mkcm("s.db", "qa-s15", "user_prompt:fix the importer,decision:keep v22"), ""],
      ["no sessions dir, no session id", () => {}, ""],
    ];
    let vi = 0;
    for (const [name, setup, sid] of variants) {
      // A fresh sessions dir per variant (a leaked handle can pin the previous one on Windows).
      sessionsDirV = join(home, "v" + (++vi), "sessions");
      if (!name.includes("missing") && !name.startsWith("no sessions dir")) mkdirSync(sessionsDirV, { recursive: true });
      setup();
      rmSync(process.env.KNOWLEDGE_V2_DB, { force: true });
      const db = dbv2.openV2Database(process.env.KNOWLEDGE_V2_DB);
      console.log(`-- ${name}`);
      // Both trees read ~/.claude/context-mode/sessions by default (base cannot be told otherwise, and
      // logInvocations reads only that path in both): make it a junction to this variant's dir, and pass
      // NO sessionsDir, so both trees see the same dir through the production default.
      rmSync(join(home, ".claude", "context-mode"), { recursive: true, force: true });
      mkdirSync(join(home, ".claude", "context-mode"), { recursive: true });
      if (existsSync(sessionsDirV)) {
        const j = spawnSync("cmd", ["/c", "mklink", "/J", join(home, ".claude", "context-mode", "sessions"), sessionsDirV], { encoding: "utf8" });
        if (j.status !== 0) throw new Error("mklink failed " + j.stdout + j.stderr);
      }
      run(base(db, { sessionSummary: "", sessionId: sid }));
      db.close();
      for (const f of ["bad.db"]) if (existsSync(join(sessionsDirV, f))) { try { rmSync(join(sessionsDirV, f)); console.log("   bad.db deletable after session end: yes"); } catch (e) { console.log("   bad.db deletable after session end: NO, " + e.code + " (a handle is still open)"); } }
    }
  }

  if (c === "hook") {
    // The built SessionEnd hook, as a process, in this scratch home. Three states of ~/.claude/context-mode/sessions.
    const hook = join(ob, "build", "cli-session-end.js");
    const proj = join(home, "proj");
    mkdirSync(proj, { recursive: true });
    const db = dbv2.openV2Database(process.env.KNOWLEDGE_V2_DB);
    const g = seed(db, "gone"), k = seed(db, "kept");
    dbv2.recordRecallEvent(db, "qa157-hook", "typescript", [g, k]);
    db.prepare("DELETE FROM knowledge_index WHERE id = ?").run(g);
    db.close();
    const states = [
      ["real db for the session", () => mkcm("mine.db", "qa157-hook", "user_prompt:hook run,decision:ok")],
      ["garbage db only", () => { mkdirSync(sessionsDir, { recursive: true }); writeFileSync(join(sessionsDir, "bad.db"), "garbage bytes"); }],
      ["no sessions dir", () => {}],
      ["garbage db + no session id in payload", () => { mkdirSync(sessionsDir, { recursive: true }); writeFileSync(join(sessionsDir, "bad.db"), "garbage bytes"); }, "{}"],
    ];
    for (const [name, setup, payload] of states) {
      rmSync(join(home, ".claude", "context-mode"), { recursive: true, force: true });
      setup();
      const r = spawnSync(process.execPath, [hook], {
        input: payload ?? JSON.stringify({ session_id: "qa157-hook", hook_event_name: "SessionEnd" }),
        env: { ...process.env, CLAUDE_PROJECT_DIR: proj, CLAUDE_CODE_SESSION_ID: "" }, encoding: "utf8", timeout: 60000,
      });
      console.log(`-- hook: ${name}: exit=${r.status} signal=${r.signal}`);
      for (const l of r.stdout.split("\n").filter(Boolean)) console.log(`  OUT ${l}`);
      for (const l of r.stderr.split("\n").filter(Boolean)) console.log(`  ERR ${l}`);
    }
  }
}

function legacyLines(result) {
  const genLabel = result.summary.selfGenerated ? " (self-generated)" : "";
  return [
    `Summary: ${result.summary.written ? "written" : "skipped"}${genLabel}`,
    `Feedback: ${result.feedback.processed} entries`,
    `Invocations: ${result.invocations.logged} logged`,
  ];
}
