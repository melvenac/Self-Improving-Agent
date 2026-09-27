// QA 145 probes (record session 145): run against a BUILT SIA checkout.
//   node qa145-probes.mjs <SIA checkout> <transcript.md>
// No shell: every command is spawnSync with an args array; every command, its output and exit code go into the
// transcript. HOME, USERPROFILE, KNOWLEDGE_V2_DB and OPEN_BRAIN_VAULT_DIR point into a scratch folder under TEMP.
// P-HOOK: the real built session-end hook (open-brain/build/cli-session-end.js) in install (iii), a and b.
// P-JSON: a state.json of {}, [], null, 42, "text", true: what check says, and what /start's handleStart does.
// P-WALK: the root walker from SIA's own directories, and the new roots inside SIA's tree.
// P-STRAY: a stray .agents/state.json or .agents/SYSTEM/ between a real project and the cwd, through sync and state show.
// P-UNDO: moveResidue's double failure (a move that cannot be undone): what the CLI would print.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const SIA = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
const CLI = join(SIA, "open-brain", "build", "cli.js");
const HOOK = join(SIA, "open-brain", "build", "cli-session-end.js");
const SCRATCH = mkdtempSync(join(tmpdir(), "qa145-probes-"));
const HOME = join(SCRATCH, "home");
mkdirSync(HOME, { recursive: true });
const ENV = { ...process.env, HOME, USERPROFILE: HOME, KNOWLEDGE_V2_DB: join(HOME, ".claude", "open-brain", "knowledge-v2.db"), OPEN_BRAIN_VAULT_DIR: join(HOME, "vault") };
delete ENV.CLAUDE_PROJECT_DIR;
delete ENV.CLAUDE_CODE_SESSION_ID;
const GIT_ID = ["-c", "user.name=QA145", "-c", "user.email=qa145@example.invalid"];
const stamp = (() => { try { return JSON.parse(readFileSync(join(SIA, "open-brain/build/build-info.json"), "utf8")).commit; } catch { return "unread"; } })();
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: SIA, encoding: "utf8" }).stdout.trim();

writeFileSync(OUT, `# QA 145 probes\n\nSIA: \`${SIA}\` at \`${head.slice(0, 7)}\`, build stamp \`${stamp}\`. Scratch: \`${SCRATCH}\`. Node ${process.version}, ${process.platform}.\n\n`);
const log = (s) => appendFileSync(OUT, s + "\n");
const note = (s) => log(`> ${s}\n`);
const results = [];
function row(id, what, ok, detail = "") { results.push({ id, what, ok, detail }); log(`**${ok ? "OK" : "FAIL"}** ${id} — ${what}${detail ? `: ${detail}` : ""}\n`); return ok; }
function run(cmd, args, cwd, { env = ENV, input, label } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env, input });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  log("```\n$ " + (label ?? `${cmd === process.execPath ? "node" : cmd} ${args.join(" ")}`) + `   (cwd ${cwd})\n` + out.replace(/\s+$/, "") + `\n[exit ${r.status}]\n` + "```\n");
  return { status: r.status, out };
}
const OB = (cwd, ...a) => run(process.execPath, [CLI, ...a], cwd, { label: `OB ${a.join(" ")}` });
const G = (cwd, ...a) => run("git", [...GIT_ID, ...a], cwd, { label: `git ${a.join(" ")}` });
const gitq = (cwd, ...a) => spawnSync("git", [...GIT_ID, ...a], { cwd, encoding: "utf8" }).stdout ?? "";
function write(p, t) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t); }
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
const diffTrees = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
const line = (out, label) => (out.match(new RegExp(`^${label}\\s+(.*)$`, "m")) ?? [, ""])[1];
async function mod(rel) { return import(pathToFileURL(join(SIA, "open-brain/build", rel)).href); }

// ---------------------------------------------------------------------------
log(`## P-HOOK: the real built session-end hook in install (iii)\n`);
// The DB and the vault exist in scratch, so the hook runs every stage, not only the handoff check.
{
  const { openV2Database } = await mod("db-v2.js");
  const db = openV2Database(ENV.KNOWLEDGE_V2_DB); db.close();
  mkdirSync(ENV.OPEN_BRAIN_VAULT_DIR, { recursive: true });
  note(`Scratch DB created with this build's openV2Database at ${ENV.KNOWLEDGE_V2_DB}; vault ${ENV.OPEN_BRAIN_VAULT_DIR}.`);
}
async function installIII(tag, parentIsRepo) {
  const parent = join(SCRATCH, tag, "node-parent");
  const child = join(parent, "tools", "csvtool");
  write(join(parent, "package.json"), '{"name":"node-parent","version":"3.1.4"}\n');
  write(join(parent, ".agents/SYSTEM/SUMMARY.md"), "# node-parent\n");
  write(join(parent, ".agents/TASKS/INBOX.md"), "# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n");
  write(join(parent, ".agents/TASKS/task.md"), "# Task\n\n## Current Objective\n\n**The parent's objective**\n");
  write(join(child, "pyproject.toml"), '[project]\nname = "csvtool"\nversion = "0.3.0"\n');
  write(join(child, "csvtool/__main__.py"), "print('csv')\n");
  if (parentIsRepo) { G(parent, "init", "-q", "-b", "master"); G(parent, "add", "-A", "--", ".", ":(exclude)tools"); G(parent, "commit", "-q", "-m", "parent"); }
  G(child, "init", "-q", "-b", "master");
  write(join(child, ".gitignore"), "__pycache__/\n");
  G(child, "add", "-A", "--", ".", ":(exclude).agents");
  G(child, "commit", "-q", "-m", "The project before SIA");
  OB(child, "bootstrap", "scaffold");
  const inbox = join(child, ".agents/TASKS/INBOX.md");
  const heads = readFileSync(inbox, "utf8").split(/\r?\n/).filter((l) => /^## \S+ P[0-3] /.test(l));
  writeFileSync(inbox, `# Inbox\n\n${heads[0]}\n\n- [ ] Read stdin\n\n${heads.slice(1).join("\n\n")}\n`);
  OB(child, "state", "import", "--draft");
  OB(child, "state", "import", "--commit");
  G(child, "add", "-A");
  G(child, "commit", "-q", "-m", "Bootstrap SIA");
  return { parent, child };
}
function loopWork(dir, branch) {
  G(dir, "checkout", "-q", "-b", branch);
  write(join(dir, `${branch.replace(/\//g, "-")}.txt`), "work\n");
  G(dir, "add", "-A"); G(dir, "commit", "-q", "-m", `work on ${branch}`);
  G(dir, "checkout", "-q", "master");
}
for (const [tag, parentIsRepo] of [["iii-b", true], ["iii-a", false]]) {
  log(`### Install (${tag}): ${parentIsRepo ? "the parent is a repository; the child its own repository inside it" : "the parent is not a repository; the child becomes one at step 2.2"}\n`);
  const since = new Date(Date.now() - 5000);
  const { parent, child } = await installIII(tag, parentIsRepo);
  row(`H-${tag}-setup`, "the child has its own record", existsSync(join(child, ".agents/state.json")));
  loopWork(child, "loop/child-work");
  if (parentIsRepo) loopWork(parent, "loop/parent-work");
  note(`Both ${parentIsRepo ? "repositories have" : "the child has"} a loop/* commit since the session start and no handoff, so the hook's handoff guard writes its marker into whichever project it resolved.`);
  for (const drifted of [false, true]) {
    const before = hashTree(parent, ["tools", ".git"]);
    const statusBefore = parentIsRepo ? gitq(parent, "status", "--porcelain", "--untracked-files=all") : "";
    const refsBefore = parentIsRepo ? gitq(parent, "for-each-ref") : "";
    const childMarker = join(child, ".agents/SESSIONS/.missing-handoff.jsonl");
    rmSync(childMarker, { force: true });
    const transcript = join(SCRATCH, `${tag}-transcript.jsonl`);
    writeFileSync(transcript, JSON.stringify({ type: "user", timestamp: since.toISOString() }) + "\n");
    const env = { ...ENV };
    if (!drifted) env.CLAUDE_PROJECT_DIR = child;
    const cwd = drifted ? join(child, "csvtool") : child;
    log(`#### ${drifted ? "No CLAUDE_PROJECT_DIR; cwd child/csvtool/ (a drifted cwd)" : "CLAUDE_PROJECT_DIR = the child"}\n`);
    const h = run(process.execPath, [HOOK], cwd, { env, input: JSON.stringify({ session_id: `qa145-${tag}`, transcript_path: transcript, hook_event_name: "SessionEnd" }), label: `node open-brain/build/cli-session-end.js  <<< {session_id, transcript_path}${drifted ? "" : `  CLAUDE_PROJECT_DIR=${child}`}` });
    const k = `H-${tag}-${drifted ? "cwd" : "env"}`;
    row(k, "the hook ran and exited 0", h.status === 0);
    row(k, "its handoff guard answered for the CHILD's branch", /HANDOFF MISSING: .*loop\/child-work/.test(h.out) && !/loop\/parent-work/.test(h.out), (h.out.match(/\[session-end\] (HANDOFF MISSING|handoff check)[^\n]*/) ?? [""])[0].slice(0, 160));
    row(k, "its write (the missing-handoff marker) landed in the CHILD", existsSync(childMarker));
    const changed = diffTrees(before, hashTree(parent, ["tools", ".git"]));
    row(k, "the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new)", changed.length === 0, changed.join(", "));
    if (parentIsRepo) {
      row(k, "the parent's git status and refs are what they were", gitq(parent, "status", "--porcelain", "--untracked-files=all") === statusBefore && gitq(parent, "for-each-ref") === refsBefore);
    }
  }
}

// ---------------------------------------------------------------------------
log(`## P-JSON: a state.json that parses and is not a record-shaped object\n`);
for (const [name, text] of [["{}", "{}\n"], ["[]", "[]\n"], ["null", "null\n"], ["42", "42\n"], ['"text"', '"text"\n'], ["true", "true\n"], ["{\"project\":{}}", '{"project":{}}\n']]) {
  const dir = join(SCRATCH, "json", Buffer.from(name).toString("hex"));
  write(join(dir, "main.py"), "print(1)\n");
  write(join(dir, ".agents/state.json"), text);
  log(`### state.json = \`${name}\`\n`);
  const c = OB(dir, "bootstrap", "check");
  const s = run(process.execPath, ["--input-type=module", "-e",
    `const { handleStart } = await import(${JSON.stringify(pathToFileURL(join(SIA, "open-brain/build/server.js")).href)}); const r = await handleStart({ project_root: ${JSON.stringify(dir)} }); for (const c of r.content) console.log(c.text); console.log("isError:", !!r.isError);`],
    dir, { label: `node -e "handleStart({ project_root })"` });
  const m = OB(dir, "bootstrap", "move-residue");
  results.push({ id: `J-${name}`, what: "probe", ok: true, detail: JSON.stringify({ agents: line(c.out, "\\.agents/:"), next: line(c.out, "Next:"), startIsError: /isError: true/.test(s.out), startFirst: s.out.split(/\r?\n/).filter((l) => l.trim()).slice(0, 3).join(" | ").slice(0, 300), moveResidue: m.status, fileKept: readFileSync(join(dir, ".agents/state.json"), "utf8") === text }) });
}

// ---------------------------------------------------------------------------
log(`## P-WALK: the root walker inside SIA's own tree\n`);
{
  const rr = await mod("shared/repo-root.js");
  for (const d of ["", "open-brain", "open-brain/src", "docs", "open-brain/tests/pipelines"]) {
    const got = rr.resolveRepoRoot(join(SIA, d));
    row(`W-sia-${d || "root"}`, `resolveRepoRoot(<SIA>/${d}) is SIA`, got === SIA, got);
  }
  // The stray open-brain/.agents/ (gitignored): made here for the probe, removed after.
  const stray = join(SIA, "open-brain", ".agents");
  const had = existsSync(stray);
  if (!had) { mkdirSync(stray); writeFileSync(join(stray, "reflection-queue.json"), "[]\n"); }
  row("W-stray", "with the stray open-brain/.agents/reflection-queue.json, open-brain/ is not a root and open-brain/src resolves to SIA",
    !rr.isProjectRoot(join(SIA, "open-brain")) && rr.resolveRepoRoot(join(SIA, "open-brain/src")) === SIA && rr.resolveHookProjectDir(join(SIA, "open-brain")) === SIA);
  if (!had) rmSync(stray, { recursive: true, force: true });
  // Every directory in SIA's tracked tree that is a root under this build's rule.
  const files = spawnSync("git", ["ls-files"], { cwd: SIA, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const dirs = new Set();
  for (const f of files) { const m = f.match(/^(.*?)\/?\.agents\/(SYSTEM|META|state\.json)(\/|$)/); if (m) dirs.add(m[1]); }
  const roots = [...dirs].filter((d) => rr.isProjectRoot(join(SIA, d))).sort();
  results.push({ id: "W-roots-in-sia", what: "tracked directories that are roots", ok: true, detail: JSON.stringify(roots) });
  log(`Directories in SIA's tracked tree that are roots under this build: ${roots.map((r) => `\`${r || "."}\``).join(", ")}\n`);
  for (const d of roots.filter(Boolean)) {
    const got = rr.resolveRepoRoot(join(SIA, d));
    results.push({ id: `W-root-${d}`, what: `resolveRepoRoot(<SIA>/${d})`, ok: true, detail: got });
  }
  // Home: this machine's real home, read only.
  const realHome = process.env.USERPROFILE || process.env.HOME;
  const realAgents = join(realHome, ".agents");
  results.push({ id: "W-real-home", what: "this machine's home", ok: true, detail: JSON.stringify({ home: realHome, agents: existsSync(realAgents) ? readdirSync(realAgents) : "absent", isProjectRoot: rr.isProjectRoot(realHome) }) });
}

// ---------------------------------------------------------------------------
log(`## P-STRAY: a stray between a real project and the cwd\n`);
for (const kind of ["state.json (zero bytes)", "state.json (a copied record)", "SYSTEM/"]) {
  const P = join(SCRATCH, "stray", kind.replace(/[^a-z]/gi, ""));
  write(join(P, "package.json"), '{"name":"real","version":"1.0.0"}\n');
  write(join(P, ".agents/SYSTEM/SUMMARY.md"), "# real\n");
  write(join(P, ".agents/state.json"), '{"schema_version":3,"revision":7,"project":{"name":"real"}}\n');
  const x = join(P, "packages", "x");
  if (kind.startsWith("state.json (zero")) write(join(x, ".agents/state.json"), "");
  else if (kind.startsWith("state.json (a copied")) write(join(x, ".agents/state.json"), '{"schema_version":3,"revision":1,"project":{"name":"copied-fixture"}}\n');
  else write(join(x, ".agents/SYSTEM/SUMMARY.md"), "# a fixture\n");
  const cwd = join(x, "src");
  mkdirSync(cwd, { recursive: true });
  log(`### The stray is packages/x/.agents/${kind}; cwd packages/x/src\n`);
  const rr = await mod("shared/repo-root.js");
  const got = rr.resolveRepoRoot(cwd);
  results.push({ id: `S-${kind}`, what: "resolveRepoRoot from below a stray", ok: true, detail: `${got === x ? "the STRAY (packages/x)" : got === P ? "the real project" : got}` });
  note(`resolveRepoRoot(packages/x/src) = ${got}`);
  OB(cwd, "state", "show");
  OB(cwd, "sync", "--check");
}

// ---------------------------------------------------------------------------
log(`## P-UNDO: a residue move that fails part-way and cannot be undone\n`);
{
  const b = await mod("pipelines/bootstrap/index.js");
  const dir = join(SCRATCH, "undo");
  write(join(dir, ".agents/aaa/one.txt"), "1\n");
  write(join(dir, ".agents/bbb.json"), "{}\n");
  const { renameSync } = await import("node:fs");
  let calls = 0;
  // The first entry (aaa/) really moves. The second rename fails, after something recreated .agents/aaa/ with a
  // file in it, so moving aaa/ back cannot succeed: the double failure the catch block's inner branch handles.
  const rename = (from, to) => { calls++; if (calls === 1) return renameSync(from, to); write(join(dir, ".agents/aaa/blocker.txt"), "x\n"); throw new Error("EBUSY: simulated"); };
  let err = null;
  try { b.moveResidue(dir, "2026-09-26", { rename }); } catch (e) { err = e; }
  const readBack = typeof b.ResidueReadBackError === "function" && err instanceof b.ResidueReadBackError;
  const printed = err ? (readBack ? `bootstrap move-residue — MOVED, but ${err.message}` : `bootstrap move-residue refused: ${err.message}`) : "(no error)";
  note(`The CLI's catch, applied to what moveResidue threw: ${printed}`);
  const movedAside = existsSync(join(dir, ".agents/archive/pre-bootstrap-residue-2026-09-26/aaa/one.txt"));
  results.push({ id: "U-double-failure", what: "the CLI's words when a move cannot be undone", ok: true, detail: JSON.stringify({ printed, movedAside }) });
}

log(`## Results\n`);
log("| Id | What | Result |\n|---|---|---|");
for (const r of results) log(`| ${r.id} | ${r.what}${r.detail ? ` (${String(r.detail).replace(/\|/g, "\\|")})` : ""} | ${r.ok ? "OK" : "**FAIL**"} |`);
const failed = results.filter((r) => !r.ok);
log(`\n**${results.length} rows, ${failed.length} failed.**`);
console.log(`${results.length} rows, ${failed.length} failed. Transcript: ${OUT}`);
for (const f of failed) console.log(`FAIL ${f.id} ${f.what} ${f.detail}`);
for (const r of results.filter((r) => r.what === "probe" || r.id.startsWith("W-") || r.id.startsWith("S-") || r.id.startsWith("U-"))) console.log(`${r.id}: ${r.detail}`);
process.exit(failed.length ? 1 : 0);
