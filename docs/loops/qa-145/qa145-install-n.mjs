// QA 145's own install (N): a child folder INSIDE the parent's repository that is not its own repository
// (handoff section 7, "nested and untracked"). Followed as a stranger would: every step taken is the one
// `check`'s Next names, except where Next names none; each such step is counted as a manual fix.
//   node qa145-install-n.mjs <SIA checkout> <transcript.md>
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync, mkdtempSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const SIA = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
const CLI = join(SIA, "open-brain", "build", "cli.js");
const SCRATCH = mkdtempSync(join(tmpdir(), "qa145-install-n-"));
const HOME = join(SCRATCH, "home");
mkdirSync(HOME, { recursive: true });
const ENV = { ...process.env, HOME, USERPROFILE: HOME, KNOWLEDGE_V2_DB: join(HOME, "knowledge-v2.db"), OPEN_BRAIN_VAULT_DIR: join(HOME, "vault") };
delete ENV.CLAUDE_PROJECT_DIR;
const GIT_ID = ["-c", "user.name=QA145", "-c", "user.email=qa145@example.invalid"];
writeFileSync(OUT, `# QA 145 install (N): a nested, untracked child\n\nSIA: \`${SIA}\`. Scratch: \`${SCRATCH}\`. Node ${process.version}, ${process.platform}.\n\n`);
const log = (s) => appendFileSync(OUT, s + "\n");
const note = (s) => log(`> ${s}\n`);
const verdicts = [];
const manual = [];
function ok(what, cond, detail = "") { verdicts.push({ what, ok: cond, detail }); log(`**${cond ? "OK" : "FAIL"}** — ${what}${detail ? `: ${detail}` : ""}\n`); return cond; }
function run(cmd, args, cwd, label) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: ENV });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  log("```\n$ " + label + "\n" + out.replace(/\s+$/, "") + `\n[exit ${r.status}]\n` + "```\n");
  return { status: r.status, out };
}
const OB = (cwd, ...a) => run(process.execPath, [CLI, ...a], cwd, `OB ${a.join(" ")}`);
const G = (cwd, ...a) => run("git", [...GIT_ID, ...a], cwd, `git ${a.join(" ")}`);
function write(p, t) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t); }
const nextOf = (out) => (out.match(/^Next:\s+(.*)$/m) ?? [, ""])[1];
function hashTree(dir, skip = [], rel = "") {
  const out = {};
  for (const n of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${n.name}` : n.name;
    if (skip.some((s) => r === s || r.startsWith(`${s}/`))) continue;
    if (n.isDirectory()) Object.assign(out, hashTree(dir, skip, r));
    else out[r] = createHash("sha256").update(readFileSync(join(dir, r))).digest("hex").slice(0, 16);
  }
  return out;
}
function step(dir, pattern, taken) {
  const c = OB(dir, "bootstrap", "check");
  const named = pattern.test(nextOf(c.out));
  ok(`check's Next names the step taken (${taken})`, named, named ? "" : `Next was: ${nextOf(c.out)}`);
  if (!named) manual.push(taken);
  return c;
}

const parent = join(SCRATCH, "node-parent");
const child = join(parent, "tools", "csvtool");
write(join(parent, "package.json"), '{"name":"node-parent","version":"3.1.4"}\n');
write(join(parent, ".agents/SYSTEM/SUMMARY.md"), "# node-parent\n");
write(join(parent, ".agents/TASKS/INBOX.md"), "# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n");
write(join(parent, ".agents/TASKS/task.md"), "# Task\n\n## Current Objective\n\n**The parent's objective**\n");
write(join(parent, "index.js"), "console.log('parent')\n");
G(parent, "init", "-q", "-b", "master");
G(parent, "add", "-A");
G(parent, "commit", "-q", "-m", "parent");
write(join(child, "pyproject.toml"), '[project]\nname = "csvtool"\nversion = "0.3.0"\n');
write(join(child, "csvtool/__main__.py"), "# TODO: read stdin\nprint('csv')\n");
note("The parent is a repository with .agents/ and a package.json. tools/csvtool/ (pyproject.toml, no package.json) sits inside it, untracked, and is not its own repository.");
const before = hashTree(parent, ["tools", ".git"]);
const statusBefore = spawnSync("git", ["status", "--porcelain"], { cwd: parent, encoding: "utf8" }).stdout;

log("## Step 1\n");
const c1 = OB(child, "bootstrap", "check");
ok("check STOPs", /^STOP:/.test(nextOf(c1.out)), nextOf(c1.out));
ok("check names the enclosing repository (git's form: forward slashes)", nextOf(c1.out).includes(parent.replace(/\\/g, "/")));
ok("check names an action a stranger can take here (git init, or make this folder its own repository)", /git init|its own repository/i.test(nextOf(c1.out)), nextOf(c1.out));
note("bootstrap.md step 1 is read for the STOP row next.");
const md = readFileSync(join(SIA, "project-template/.claude/commands/bootstrap.md"), "utf8");
const stopRows = md.split(/\r?\n/).filter((l) => /inside another repository|nested/i.test(l));
log("bootstrap.md lines that mention the nested case:\n\n" + stopRows.map((l) => `    ${l}`).join("\n") + "\n");
ok("bootstrap.md says what to do in the nested case (git init the child, or move it out)", stopRows.some((l) => /git init/.test(l)), `${stopRows.length} line(s)`);

log("## The stranger ignores STOP and runs each later step\n");
ok("scaffold refuses and writes nothing", OB(child, "bootstrap", "scaffold").status === 1 && !existsSync(join(child, ".agents")));
ok("state import --draft refuses (no .agents/ here) and never walks up", OB(child, "state", "import", "--draft").status === 1);
ok("the parent gained nothing so far", JSON.stringify(hashTree(parent, ["tools", ".git"])) === JSON.stringify(before));

log("## The stranger makes the child its own repository (the only reading of \"at its own repository root\")\n");
manual.push("git init in the child: check names the goal, not the command");
G(child, "init", "-q", "-b", "master");
step(child, /^Commit the project as it stands|^git init/, "2.2 the before-SIA commit");
write(join(child, ".gitignore"), "__pycache__/\n");
G(child, "add", "-A", "--", ".", ":(exclude).agents");
G(child, "commit", "-q", "-m", "The project before SIA");
step(child, /^Scaffold/, "3 scaffold");
const s = OB(child, "bootstrap", "scaffold");
ok("scaffold exits 0", s.status === 0);
step(child, /^Scaffolded, not yet imported: continue at step 4/, "4 CLAUDE.md");
const sia = md.match(/```markdown\n([\s\S]*?)```/)[1];
write(join(child, "CLAUDE.md"), `# csvtool\n\n**About:** a CSV tool\n\n${sia}`);
const inbox = join(child, ".agents/TASKS/INBOX.md");
const heads = readFileSync(inbox, "utf8").split(/\r?\n/).filter((l) => /^## \S+ P[0-3] /.test(l));
writeFileSync(inbox, `# Inbox\n\n${heads[0]}\n\n- [ ] Read stdin\n\n${heads.slice(1).join("\n\n")}\n`);
const d = OB(child, "state", "import", "--draft");
ok("the draft validates for THIS folder, named by the folder", d.status === 0 && d.out.includes(`Root: ${child}`) && /^Project: csvtool — the folder's name/m.test(d.out) && /^Tasks: 1/m.test(d.out));
const cm = OB(child, "state", "import", "--commit");
ok("--commit writes the child's record", cm.status === 0 && existsSync(join(child, ".agents/state.json")));
G(child, "add", "-A");
G(child, "commit", "-q", "-m", "Bootstrap SIA");
const fin = OB(child, "bootstrap", "check");
ok("a final check says BOOTSTRAPPED", /BOOTSTRAPPED/.test(fin.out));
const after = hashTree(parent, ["tools", ".git"]);
const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
ok("the parent's files outside tools/ are unchanged", changed.length === 0, changed.join(", "));
const statusAfter = spawnSync("git", ["status", "--porcelain"], { cwd: parent, encoding: "utf8" }).stdout;
note(`The parent's git status before: ${JSON.stringify(statusBefore)}; after: ${JSON.stringify(statusAfter)}. (The child is now a nested repository, which the parent sees as one untracked directory.)`);

log(`## Verdicts\n`);
for (const v of verdicts) log(`- ${v.ok ? "OK" : "**FAIL**"} ${v.what}${v.detail ? ` (${v.detail})` : ""}`);
log(`\n**Manual fixes (steps no Next named):** ${manual.length ? manual.join("; ") : "none"}`);
const failed = verdicts.filter((v) => !v.ok);
log(`\n**${verdicts.length} checks, ${failed.length} failed.**`);
console.log(`${verdicts.length} checks, ${failed.length} failed; manual fixes: ${manual.join("; ") || "none"}`);
for (const f of failed) console.log(`FAIL ${f.what} ${f.detail}`);
