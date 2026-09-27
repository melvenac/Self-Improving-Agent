#!/usr/bin/env node
// T-048 r3 probes. Usage: node probe-r3.mjs <open-brain-root>
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const toUrl = (p) => pathToFileURL(p).href;

const obRoot = process.argv[2];
if (!obRoot) {
  console.error("usage: node probe-r3.mjs <open-brain-root>");
  process.exit(2);
}

const scratch = mkdtempSync(join(tmpdir(), "t048r3probe-"));
const home = join(scratch, "home");
const dbPath = join(scratch, "db", "knowledge-v2.db");
const active = join(home, ".claude", "open-brain", "active-session");
mkdirSync(active, { recursive: true });
mkdirSync(dirname(dbPath), { recursive: true });

const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  KNOWLEDGE_V2_DB: dbPath,
  OPEN_BRAIN_VAULT_DIR: join(home, "vault"),
  OPEN_BRAIN_ACTIVE_SESSION: active,
  TEMP: process.env.TEMP ?? "C:\\qa-tmp",
  TMP: process.env.TMP ?? "C:\\qa-tmp",
};

const runVitest = (filter) => {
  const r = spawnSync(
    "npx",
    ["vitest", "run", filter],
    { cwd: obRoot, env, encoding: "utf8", shell: true },
  );
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
};

const importBuilt = async () => await import(toUrl(join(obRoot, "build/server.js")));

const text = (res) => res.content.map((c) => c.text).join("\n");

async function main() {
  const out = [];
  const log = (section, body) => {
    out.push(`== ${section} ==\n${body}\n`);
    console.log(`== ${section} ==`);
    console.log(body);
  };

  const tests = runVitest("tests/t048-r3.test.ts");
  log("t048-r3.test.ts", `exit=${tests.code}\n${tests.stdout}${tests.stderr}`);

  const { handleSync, handleScore, handleEnd, handleRecall } = await importBuilt();
  const SESSION = "00000182-0000-4000-8000-000000000182";

  function project() {
    const dir = mkdtempSync(join(scratch, "proj-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.0.0" }));
    return dir;
  }

  // T048-D1: missing, corrupt, unreadable via mocked readLastInvocationTs is in tests.
  // Real invocation log file states for sync/score when log file exists.
  for (const [label, content] of [
    ["missing", null],
    ["corrupt", "not-json\n"],
    ["unreadable", "__LOCKED__"],
  ]) {
    const tmp = project();
    const logDir = join(home, ".claude", "open-brain");
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, "invocation-log.jsonl");
    try { rmSync(logFile, { force: true }); } catch {}
    let lockFd = null;
    if (label === "missing") {
      // no file
    } else if (label === "unreadable") {
      writeFileSync(logFile, '{"ts":"2026-01-01T00:00:00.000Z","type":"summary"}\n');
      lockFd = openSync(logFile, "r+");
    } else {
      writeFileSync(logFile, content);
    }
    const sync = text(await handleSync({ project_root: tmp, check_only: true, score: true }));
    const score = text(await handleScore({ project_root: tmp }));
    if (lockFd !== null) closeSync(lockFd);
    log(`score-${label}`, `sync:\n${sync}\n\nscore:\n${score}`);
  }

  // SILENT 9 detail
  const tmp9 = project();
  const noId = text(await handleEnd({ project_root: tmp9, dry_run: true, session_summary: "s" }));
  writeFileSync(join(tmp9, ".recalled-entries.json"), "{");
  const rejected = text(await handleEnd({ project_root: tmp9, dry_run: true, session_summary: "s" }));
  rmSync(join(tmp9, ".recalled-entries.json"));
  const { byPidDir, processStartTime, writeProcessSession } = await import(toUrl(join(obRoot, "build/shared/process-session.js")));
  const start = processStartTime(process.ppid);
  writeProcessSession(byPidDir(env.OPEN_BRAIN_ACTIVE_SESSION), {
    session_id: SESSION,
    claude_pid: process.ppid,
    proc_start: start,
    ide: "claude",
    written_at: new Date().toISOString(),
  });
  const noRows = text(await handleEnd({ project_root: tmp9, dry_run: true, session_summary: "s" }));
  rmSync(join(byPidDir(env.OPEN_BRAIN_ACTIVE_SESSION), `${process.ppid}.json`), { force: true });
  log("silent9", `noId:\n${noId}\n\nrejected:\n${rejected}\n\nnoRows:\n${noRows}`);

  // SILENT 4: recall with trigger refusing write
  const { openV2Database, indexKnowledge } = await import(toUrl(join(obRoot, "build/db-v2.js")));
  const db = openV2Database(dbPath);
  indexKnowledge(db, {
    vaultPath: "t048-r3/hit.md",
    key: "t048-r3-hit",
    tags: "test",
    content: "xylophonequartz recall token",
  });
  db.exec(`CREATE TRIGGER IF NOT EXISTS t048_r3_refuse_recall BEFORE INSERT ON recall_log BEGIN SELECT RAISE(ABORT, 'recall-log-refused'); END;`);
  db.close();
  writeProcessSession(byPidDir(env.OPEN_BRAIN_ACTIVE_SESSION), {
    session_id: SESSION,
    claude_pid: process.ppid,
    proc_start: start,
    ide: "claude",
    written_at: new Date().toISOString(),
  });
  const recallOut = typeof handleRecall === "function"
    ? text(await handleRecall({ queries: ["xylophonequartz"] }))
    : "handleRecall not exported";
  rmSync(join(byPidDir(env.OPEN_BRAIN_ACTIVE_SESSION), `${process.ppid}.json`), { force: true });
  const cleanup = openV2Database(dbPath);
  cleanup.exec(`DROP TRIGGER IF EXISTS t048_r3_refuse_recall`);
  cleanup.prepare(`DELETE FROM knowledge_index WHERE key = ?`).run("t048-r3-hit");
  cleanup.close();
  log("silent4", recallOut);

  // Preserve: ob_end finishes (dry_run) in all three states above — no throw
  log("preserve-ob_end", "handleEnd returned in noId, rejected, noRows without throw");

  // cli.ts score line unchanged: read formatScoreCategoryLine from built module
  const { formatScoreCategoryLine, invocationLogSuffix } = await import(toUrl(join(obRoot, "build/pipelines/sync/score-line.js")));
  const cat = { name: "Pipeline Health", score: 0, max: 10, details: { invocationLog: "corrupt" } };
  const catRan = { ...cat, details: { invocationLog: "ran" } };
  log("cli-parity", `corrupt line: ${formatScoreCategoryLine(cat)}\nsuffix corrupt: ${invocationLogSuffix(cat)}\nsuffix ran: "${invocationLogSuffix(catRan)}"`);

  const evidence = join(dirname(fileURLToPath(import.meta.url)), "evidence", "probe-r3.out");
  mkdirSync(dirname(evidence), { recursive: true });
  writeFileSync(evidence, out.join("\n"));
  rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
