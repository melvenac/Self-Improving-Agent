// QA 291 #498 rows 11-14: /bootstrap as written on the import path, L2 refusals and rollback, L3/L4, Windows I1/I3/I7.
// Drives the real CLI (node build/cli.js) from the project root and the real ob_start (MCP stdio).
// Usage: node s-import.mjs <scenario>    QA_OB selects the open-brain tree (default: the #498 head).
process.env.QA_OB ||= "C:/qa-scratch/qa291-pr498/open-brain";
const { execFileSync, spawnSync } = await import("node:child_process");
const { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, copyFileSync, statSync } = await import("node:fs");
const { join } = await import("node:path");
const { pathToFileURL } = await import("node:url");
const L = await import("./lib.mjs");
const { OB, R, freshDir, freshDb, env, server, prove, git, show, pick } = L;

const sc = process.argv[2];
const db = freshDb(`import-${sc}`);
const TPL = process.env.QA_TPL || join(OB, "..", "project-template").replace(/\\/g, "/");
const crlfOld = process.env.QA_CRLF === "1";
const EOL = crlfOld ? "\r\n" : "\n";
const UUID = "29100000-0000-4000-8000-0000000000f1";
const cli = (dir, ...args) => {
  const r = spawnSync(process.execPath, [join(OB, "build", "cli.js"), ...args], { cwd: dir, env: env(db), encoding: "utf8", timeout: 120_000 });
  return { status: r.status, out: ((r.stdout ?? "") + (r.stderr ?? "")).trim() };
};
const st = (dir) => git(dir, "status", "--short", "--untracked-files=all") || "(clean)";
const snap = (dir) => {
  const out = {};
  const walk = (rel) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { out[p + "/"] = "dir"; walk(p); } else out[p] = readFileSync(join(dir, p)).toString("base64");
    }
  };
  walk("");
  return out;
};
const diffSnap = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const d = [...keys].filter((k) => a[k] !== b[k]).map((k) => `${a[k] === undefined ? "+" : b[k] === undefined ? "-" : "M"} ${k}`);
  return d.length ? d.join("\n") : "NONE";
};
const commitAll = (dir, msg) => {
  git(dir, "add", "-A");
  execFileSync("git", ["-c", "user.email=qa@example.com", "-c", "user.name=QA", "commit", "-q", "-m", msg], { cwd: dir });
};
const L1 = (s) => s.split("\n").join(EOL);
/** A pre-state project as QA 290 built it: tasks under P0-P3, old start/end, other.md, settings.local.json. */
function preState(name, { ignore = true, autocrlf = false } = {}) {
  const dir = freshDir(name);
  git(dir, "init", "-q", "-b", "master");
  if (autocrlf) git(dir, "config", "core.autocrlf", "true");
  if (ignore) copyFileSync(join(TPL, "gitignore"), join(dir, ".gitignore"));
  const w = (rel, body) => { mkdirSync(join(dir, rel, ".."), { recursive: true }); writeFileSync(join(dir, rel), body); };
  w(".agents/TASKS/INBOX.md", "# Inbox\n\n## 🔴 P0 — Critical\n\n- [ ] Fix the door sensor\n\n## 🟠 P1 — High\n\n- [ ] Member sign-in\n\n## 🟡 P2 — Medium\n\n- [ ] Tool inventory\n\n## 🟢 P3 — Low\n\n- [ ] Newsletter\n");
  w(".agents/TASKS/task.md", "# Task\n\n## Current Objective\n\nShip the sign-in kiosk.\n");
  w(".agents/SYSTEM/SUMMARY.md", "# makerspace-demo\n\nStatus: pre-SIA\n");
  w(".agents/SESSIONS/next-session.md", "# Next session\n\nSession 4: pick up the kiosk.\n");
  w(".agents/SESSIONS/Session_3.md", "# Session 3\n");
  w(".claude/commands/start.md", L1("# /start (old protocol)\n\nRead INBOX.md and SUMMARY.md by hand.\n"));
  w(".claude/commands/end.md", L1("# /end (old protocol)\n\nWrite Session_N.md by hand.\n"));
  w(".claude/commands/other.md", "# other\n");
  w(".claude/settings.local.json", "{\"permissions\":{}}\n");
  w("README.md", "# makerspace-demo\n");
  commitAll(dir, "The project before SIA");
  return dir;
}
async function obStart(dir, label) {
  await prove(UUID, undefined);
  const s = await server(dir, db);
  const r = await s.call("ob_start", { project_root: dir });
  await s.close();
  const lines = pick(r.text, /OLD \/start/);
  show(`${label}: ob_start OLD /start line(s)`, lines.length ? lines.join("\n") : "(none)");
  return lines.length;
}
const commandsLine = (o) => pick(o, /^\s*commands:|^Next:|PRE-STATE|BOOTSTRAPPED/).join("\n");
const STEP8_IMPORT = [".agents/state.json", ".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md",
  ".agents/SYSTEM/SUMMARY.md", ".claude/commands/start.md", ".claude/commands/end.md", ".claude/commands/task.md", ".claude/commands/sync.md"];

if (sc === "l1" || sc === "l1-noignore" || sc === "win") {
  const win = sc === "win";
  const dir = preState(win ? "import win space/my project" : `import-${sc}`, { ignore: sc !== "l1-noignore", autocrlf: win });
  const base = git(dir, "rev-parse", "HEAD");
  if (win) show("fixture", { dir: dir.replace(/\//g, "\\"), template: TPL, autocrlf: git(dir, "config", "--get", "core.autocrlf"),
    oldStartCR: (readFileSync(join(dir, ".claude/commands/start.md"), "utf8").match(/\r/g) || []).length,
    templateStartCR: (readFileSync(join(TPL, ".claude/commands/start.md"), "utf8").match(/\r/g) || []).length });
  let r = cli(dir, "bootstrap", "check"); show(`step 1 check (exit ${r.status}) [I1]`, commandsLine(r.out));
  r = cli(dir, "bootstrap", "install-commands"); show(`I2 install before import (exit ${r.status})`, r.out);
  r = cli(dir, "state", "import", "--draft"); show(`step 6 draft (exit ${r.status})`, pick(r.out, /Validates|Tasks:|WARNING/).join("\n"));
  r = cli(dir, "state", "import", "--commit"); show(`step 7 --commit (exit ${r.status})`, r.out.split("\n").slice(0, 3).join("\n"));
  show("status after step 7", st(dir));
  const before7b = await obStart(dir, "I7 before install");
  const pre = snap(dir);
  r = cli(dir, "bootstrap", "install-commands"); show(`step 7b install-commands, no git commit between (exit ${r.status}) [I3]`, r.out);
  show("I3/I6 snapshot diff (install)", diffSnap(pre, snap(dir)));
  for (const n of ["start", "end", "task", "sync"]) {
    const a = readFileSync(join(dir, `.claude/commands/${n}.md`)), b = readFileSync(join(TPL, `.claude/commands/${n}.md`));
    show(`I3 ${n}.md byte-identical to template`, `${a.equals(b)} (CR bytes installed ${(a.toString().match(/\r/g) || []).length}, template ${(b.toString().match(/\r/g) || []).length})`);
  }
  const arch = readdirSync(join(dir, ".agents/archive")); show("archive", arch.map((a) => `${a}: ${readdirSync(join(dir, ".agents/archive", a)).join(", ")}`).join("\n"));
  r = cli(dir, "bootstrap", "check"); show(`check after 7b (exit ${r.status})`, commandsLine(r.out));
  r = cli(dir, "bootstrap", "install-commands"); show(`L4 re-run straight after install, dirty import tree (exit ${r.status})`, r.out);
  const s8 = st(dir); show("step 8 git status --short --untracked-files=all", s8);
  const listed = s8.split("\n").map((l) => l.slice(3));
  show("step 8 vs the text's import-path list", { extra: listed.filter((p) => !STEP8_IMPORT.includes(p)), missing: STEP8_IMPORT.filter((p) => !listed.includes(p)) });
  commitAll(dir, "Bootstrap SIA");
  show("commits after 'The project before SIA'", git(dir, "log", "--format=%s", `${base}..HEAD`));
  show("status after the SIA commit", st(dir));
  const after = await obStart(dir, "fresh /start after the SIA commit [I7]");
  show("I7 summary", { before: before7b, after });
} else if (sc === "l1-dirty") {
  for (const kind of ["tracked", "untracked"]) {
    const dir = preState(`import-l1-dirty-${kind}`);
    cli(dir, "state", "import", "--draft"); cli(dir, "state", "import", "--commit");
    if (kind === "tracked") writeFileSync(join(dir, "README.md"), "# changed\n"); else writeFileSync(join(dir, "scratch.txt"), "x\n");
    const pre = snap(dir);
    const r = cli(dir, "bootstrap", "install-commands"); show(`other dirty path (${kind}) (exit ${r.status})`, r.out);
    show("snapshot diff", diffSnap(pre, snap(dir)));
  }
} else if (sc === "l2-attr" || sc === "l2-acl") {
  const dir = preState(`import-${sc}`);
  cli(dir, "state", "import", "--draft"); cli(dir, "state", "import", "--commit");
  const cmd = join(dir, ".claude/commands").replace(/\//g, "\\");
  const user = execFileSync("C:\\Windows\\System32\\whoami.exe", { encoding: "utf8" }).trim();
  const lock = sc === "l2-attr"
    ? () => execFileSync("attrib", ["+R", cmd], { encoding: "utf8" })
    : () => execFileSync("icacls", [cmd, "/deny", `${user}:(OI)(CI)(W,D,DC)`], { encoding: "utf8" });
  const unlock = sc === "l2-attr"
    ? () => execFileSync("attrib", ["-R", cmd], { encoding: "utf8" })
    : () => execFileSync("icacls", [cmd, "/remove:d", user], { encoding: "utf8" });
  lock();
  show(`locked with ${sc === "l2-attr" ? "attrib +R (read-only attribute)" : `icacls /deny ${user}:(OI)(CI)(W,D,DC)`}`,
    sc === "l2-attr" ? execFileSync("attrib", [cmd], { encoding: "utf8" }).trim() : execFileSync("icacls", [cmd], { encoding: "utf8" }).trim());
  const { accessSync, constants, rmSync } = await import("node:fs");
  let acc = "passes"; try { accessSync(cmd, constants.W_OK); } catch (e) { acc = `throws ${e.code}`; }
  show("accessSync(.claude/commands, W_OK) — what the preflight calls", acc);
  let probe = "ALLOWED"; try { writeFileSync(join(dir, ".claude/commands/probe.tmp"), "x"); rmSync(join(dir, ".claude/commands/probe.tmp")); } catch (e) { probe = `BLOCKED ${e.code}`; }
  show("node (this elevated process) create+delete a file there", probe);
  show("PowerShell create a file there", (() => { try { return execFileSync("powershell", ["-NoProfile", "-Command", `try { [IO.File]::WriteAllText('${cmd}\\ps.tmp','x'); Remove-Item '${cmd}\\ps.tmp'; 'ALLOWED' } catch { 'BLOCKED ' + $_.Exception.InnerException.GetType().Name }`], { encoding: "utf8" }).trim(); } catch (e) { return `ERR ${e.message}`; } })());
  const pre = snap(dir);
  let r;
  try { r = cli(dir, "bootstrap", "install-commands"); } finally { unlock(); }
  show(`install-commands (exit ${r.status})`, r.out);
  show("snapshot diff (incl. archive dir)", diffSnap(pre, snap(dir)));
  show("archive dir exists?", existsSync(join(dir, ".agents/archive")) ? readdirSync(join(dir, ".agents/archive")).join(", ") || "(empty .agents/archive)" : "no .agents/archive");
} else if (sc === "l2-lock") {
  // A real rename failure on Windows: a PowerShell child (not detached; killed below) holds end.md open with FileShare.None.
  // Order is start, end, task, sync: start.md is renamed and replaced first, then the rename of end.md fails.
  const dir = preState("import-l2-lock");
  cli(dir, "state", "import", "--draft"); cli(dir, "state", "import", "--commit");
  const target = join(dir, ".claude/commands/end.md").replace(/\//g, "\\");
  const { spawn } = await import("node:child_process");
  const ps = spawn("powershell", ["-NoProfile", "-Command", `$f=[IO.File]::Open('${target}','Open','Read','None'); 'LOCKED'; Start-Sleep -Seconds 60; $f.Close()`], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((res, rej) => { ps.stdout.on("data", (b) => { if (String(b).includes("LOCKED")) res(); }); ps.on("exit", () => rej(new Error("lock holder exited"))); setTimeout(() => rej(new Error("lock timeout")), 30000); });
  show("lock", `end.md held open with FileShare.None by PowerShell pid ${ps.pid}`);
  const pre = snap(dir);
  let r;
  try { r = cli(dir, "bootstrap", "install-commands"); } finally { ps.kill(); await new Promise((res) => ps.on("exit", res)); }
  show(`install-commands with end.md locked (exit ${r.status})`, r.out);
  show("snapshot diff (start.md rolled back? archive dir removed?)", diffSnap(pre, snap(dir)));
  show("status", st(dir));
  r = cli(dir, "bootstrap", "install-commands"); show(`after the lock is released: install-commands (exit ${r.status})`, r.out);
} else if (sc === "l2-seam") {
  // start OLD, end SIA, task absent, sync OLD; the rename of sync fails (after start was renamed and task was copied).
  const dir = preState("import-l2-seam");
  copyFileSync(join(TPL, ".claude/commands/end.md"), join(dir, ".claude/commands/end.md"));
  writeFileSync(join(dir, ".claude/commands/sync.md"), "# /sync (old)\n");
  commitAll(dir, "end is SIA, sync is OLD");
  cli(dir, "state", "import", "--draft"); cli(dir, "state", "import", "--commit");
  show("check", commandsLine(cli(dir, "bootstrap", "check").out));
  const pre = snap(dir);
  const { installCommands } = await import(pathToFileURL(join(OB, "build/pipelines/bootstrap/index.js")).href);
  const { renameSync } = await import("node:fs");
  const calls = [];
  try {
    installCommands(dir, "2026-10-07", TPL, { rename: (a, b) => { calls.push(a.split(/[\\/]/).pop()); if (a.endsWith("sync.md")) throw new Error("QA291 seam: rename of sync.md fails"); renameSync(a, b); } });
    show("installCommands", "returned (no throw)");
  } catch (e) { show("installCommands threw", e.message); }
  show("rename calls", calls.join(", "));
  show("snapshot diff after the forced failure", diffSnap(pre, snap(dir)));
  show("status", st(dir));
} else if (sc === "l3") {
  // L3/L4: install, commit in a core.autocrlf=true repo, re-check out the commands (CRLF on disk), then check / ob_start / re-run.
  const dir = preState("import-l3", { autocrlf: true });
  cli(dir, "state", "import", "--draft"); cli(dir, "state", "import", "--commit");
  let r = cli(dir, "bootstrap", "install-commands"); show(`install (exit ${r.status})`, r.out.split("\n").slice(-4).join("\n"));
  commitAll(dir, "Bootstrap SIA");
  for (const n of ["start", "end", "task", "sync"]) require_rm(join(dir, `.claude/commands/${n}.md`));
  git(dir, "checkout", "--", ".claude/commands");
  show("CR bytes on disk after re-checkout", ["start", "end", "task", "sync"].map((n) => `${n}: ${(readFileSync(join(dir, `.claude/commands/${n}.md`), "utf8").match(/\r/g) || []).length}`).join(", "));
  show("status", st(dir));
  r = cli(dir, "bootstrap", "check"); show(`check (exit ${r.status})`, commandsLine(r.out));
  await obStart(dir, "ob_start on the CRLF re-checkout");
  const pre = snap(dir);
  r = cli(dir, "bootstrap", "install-commands"); show(`re-run (exit ${r.status})`, r.out);
  show("snapshot diff (re-run)", diffSnap(pre, snap(dir)));
  show("status", st(dir));
}
function require_rm(p) { execFileSync(process.execPath, ["-e", `require("fs").rmSync(${JSON.stringify(p)})`]); }
