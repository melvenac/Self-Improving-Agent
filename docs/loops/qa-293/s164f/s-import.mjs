// QA 293 (copied from QA 292's s164e script, re-rooted to C:/qa-tmp/qa293; see below). QA 292 row 6: #498's /bootstrap L1 path once, on #489's merged head (server.ts and the briefing carry both PRs).
// The l1 scenario of QA 291's docs/loops/qa-291/s164d/s-import.mjs, unchanged apart from the default tree (the #489
// head, which contains master 1bbf2a5d = #498 + #499) and the session uuid. The other scenarios were dropped.
// Drives the real CLI (node build/cli.js) from the project root and the real ob_start (MCP stdio).
// Usage: node s-import.mjs l1
process.env.QA_OB ||= "C:/qa-scratch/qa293-pr489/open-brain";
const { execFileSync, spawnSync } = await import("node:child_process");
const { mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync } = await import("node:fs");
const { join } = await import("node:path");
const L = await import("./lib.mjs");
const { OB, freshDir, freshDb, env, server, prove, git, show, pick } = L;

const sc = process.argv[2];
const db = freshDb(`import-${sc}`);
const TPL = process.env.QA_TPL || join(OB, "..", "project-template").replace(/\\/g, "/");
const EOL = "\n";
const UUID = "29200000-0000-4000-8000-0000000000f1";
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
function preState(name) {
  const dir = freshDir(name);
  git(dir, "init", "-q", "-b", "master");
  copyFileSync(join(TPL, "gitignore"), join(dir, ".gitignore"));
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

if (sc === "l1") {
  const dir = preState("import-l1");
  const base = git(dir, "rev-parse", "HEAD");
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
    show(`I3 ${n}.md byte-identical to template`, `${a.equals(b)}`);
  }
  const arch = readdirSync(join(dir, ".agents/archive")); show("archive", arch.map((a) => `${a}: ${readdirSync(join(dir, ".agents/archive", a)).join(", ")}`).join("\n"));
  r = cli(dir, "bootstrap", "check"); show(`check after 7b (exit ${r.status})`, commandsLine(r.out));
  const s8 = st(dir); show("step 8 git status --short --untracked-files=all", s8);
  const listed = s8.split("\n").map((l) => l.replace(/^(\?\?|[ MADRCU]{1,2}) /, "").trim());
  show("step 8 vs the text's import-path list", { extra: listed.filter((p) => !STEP8_IMPORT.includes(p)), missing: STEP8_IMPORT.filter((p) => !listed.includes(p)) });
  commitAll(dir, "Bootstrap SIA");
  show("commits after 'The project before SIA'", git(dir, "log", "--format=%s", `${base}..HEAD`));
  show("status after the SIA commit", st(dir));
  const after = await obStart(dir, "fresh /start after the SIA commit [I7]");
  show("I7 summary", { before: before7b, after });
}
