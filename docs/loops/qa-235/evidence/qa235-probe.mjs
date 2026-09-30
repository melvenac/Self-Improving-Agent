// QA 235 probes against a planner-hook build. Fixture checkout only; fake fetch; no network; the hook is never registered.
// Usage: node qa235-probe.mjs <open-brain/build dir> <fixture dir> <out.json>
// r4-1..r4-3 run through the REAL built CLI (cli-planner-hook.js) with fixture stdin; r4-4..r4-6 use
// runPlannerHookAsync with a fetch recorder so a zero-fetch claim can be asserted.
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const [BUILD, FX, OUT] = process.argv.slice(2);
const { runPlannerHookAsync } = await import(`file:///${BUILD}/planner-hook/run.js`);

for (const d of [".agents/SYSTEM", ".agents/TASKS", "open-brain/src", "open-brain/tests", "scripts", "docs/loops", "scratch", ".git"]) {
  mkdirSync(join(FX, d), { recursive: true });
}
writeFileSync(join(FX, "package.json"), '{"name":"qa235-fx"}\n');
writeFileSync(join(FX, "open-brain", "package.json"), '{"name":"open-brain"}\n');
writeFileSync(join(FX, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n');
writeFileSync(join(FX, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\n---\n");

const fwd = FX.replace(/\\/g, "/");
const back = fwd.replace(/\//g, "\\");
const outsideDir = `${dirname(fwd)}/qa235-outside`;

const out = {};
const bash = (command, cwd) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd });
const edit = (file_path, cwd) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path, old_string: "a", new_string: "b" }, cwd });
const write = (file_path, cwd) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path, content: "{}" }, cwd });

function cli(name, payload, expect) {
  // The real built CLI, a built env (no inherited GH_TOKEN), process cwd = fixture root.
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp", HOME: "C:/qa-scratch/qa235-nohome", USERPROFILE: "C:/qa-scratch/qa235-nohome" };
  const r = spawnSync(process.execPath, [join(BUILD, "cli-planner-hook.js")], { input: JSON.stringify(payload), encoding: "utf8", env, cwd: FX });
  let reason = "";
  try { reason = JSON.parse(r.stdout).hookSpecificOutput?.permissionDecisionReason ?? ""; } catch { reason = r.stdout.trim(); }
  const got = r.status === 0 ? "allow" : r.status === 2 ? "deny" : `exit${r.status}`;
  out[name] = { expect, got, pass: got === expect, exit: r.status, reason: reason.slice(0, 300) };
}

// ---------- r4-1, D3: relative targets resolve against payload.cwd (real CLI) ----------
const ob = `${fwd}/open-brain`, ag = `${fwd}/.agents`;
cli("r4-1 cwd=open-brain Bash `echo x > src/cli.ts`", bash("echo x > src/cli.ts", ob), "deny");
cli("r4-1 cwd=open-brain Bash `sed -i s/a/b/ src/cli.ts`", bash("sed -i s/a/b/ src/cli.ts", ob), "deny");
cli("r4-1 cwd=open-brain Edit relative src/cli.ts", edit("src/cli.ts", ob), "deny");
cli("r4-1 cwd=open-brain Write relative src/cli.ts", write("src/cli.ts", ob), "deny");
cli("r4-1 cwd=.agents Bash `echo {} > state.json`", bash("echo {} > state.json", ag), "deny");
cli("r4-1 cwd=.agents Bash `echo x > TASKS/INBOX.md`", bash("echo x > TASKS/INBOX.md", ag), "deny");
cli("r4-1 cwd=.agents Write relative state.json", write("state.json", ag), "deny");
cli("r4-1 cwd=open-brain Bash tee src/x.ts", bash("echo x | tee src/x.ts", ob), "deny");
cli("r4-1 cwd=open-brain Bash cp a tests/x.ts", bash("cp a.ts tests/x.ts", ob), "deny");
cli("r4-1 cwd=open-brain Bash mv a package.json", bash("mv a.json package.json", ob), "deny");
cli("r4-1 cwd=open-brain Bash 2>> src/x.log", bash("npm test 2>> src/x.log", ob), "deny");
cli("r4-1 cwd=open-brain/src Bash `echo x > cli.ts`", bash("echo x > cli.ts", `${ob}/src`), "deny");
cli("r4-1 cwd=open-brain (BACKSLASH form) Bash `echo x > src/cli.ts`", bash("echo x > src/cli.ts", `${back}\\open-brain`), "deny");
cli("r4-1 cwd=open-brain (trailing slash) Bash `echo x > src/cli.ts`", bash("echo x > src/cli.ts", `${ob}/`), "deny");
cli("r4-1 cwd=open-brain (Git Bash /c/ form) Bash `echo x > src/cli.ts`", bash("echo x > src/cli.ts", `/${fwd[0].toLowerCase()}${fwd.slice(2)}/open-brain`), "deny");
cli("r4-1 ../ cwd=docs/loops Bash `echo x > ../../open-brain/src/cli.ts`", bash("echo x > ../../open-brain/src/cli.ts", `${fwd}/docs/loops`), "deny");
cli("r4-1 ../ cwd=docs Write ../.agents/state.json", write("../.agents/state.json", `${fwd}/docs`), "deny");
cli("r4-1 ../ cwd=open-brain Bash `echo x > ../scripts/x.sh`", bash("echo x > ../scripts/x.sh", ob), "deny");
cli("r4-1 ../ cwd=open-brain/src Edit ../../package.json", edit("../../package.json", `${ob}/src`), "deny");
cli("r4-1 control cwd=docs/loops Bash `echo x > src/cli.ts` (lands in docs/loops/src)", bash("echo x > src/cli.ts", `${fwd}/docs/loops`), "allow");
cli("r4-1 control cwd=scratch Bash `echo {} > state.json`", bash("echo {} > state.json", `${fwd}/scratch`), "allow");
cli("r4-1 control cwd=open-brain Bash `echo x > notes.md`", bash("echo x > notes.md", ob), "allow");
cli("r4-1 control cwd=docs/loops Edit relative src/cli.ts", edit("src/cli.ts", `${fwd}/docs/loops`), "allow");
cli("r4-1 control cwd=root Write docs/loops/q.md", write("docs/loops/q.md", fwd), "allow");
// Declared limit: a cd inside the same command line is not followed.
cli("LIMIT cwd=root `cd open-brain && echo x > src/cli.ts`", bash("cd open-brain && echo x > src/cli.ts", fwd), "allow");
cli("LIMIT cwd=root `(cd open-brain; echo x > src/cli.ts)`", bash("(cd open-brain; echo x > src/cli.ts)", fwd), "allow");

// ---------- r4-2, outside the repo is allowed; undeterminable is denied with a cause (real CLI) ----------
cli("r4-2 `npm test 2> C:/qa-tmp/log.txt`", bash("npm test 2> C:/qa-tmp/log.txt", fwd), "allow");
cli("r4-2 cwd=open-brain `npm test 2> C:/qa-tmp/log.txt`", bash("npm test 2> C:/qa-tmp/log.txt", ob), "allow");
cli("r4-2 Bash redirect outside (fwd)", bash(`echo x > ${outsideDir}/x.txt`, fwd), "allow");
cli("r4-2 Bash redirect outside (back, quoted)", bash(`echo x > "C:\\qa-tmp\\x.txt"`, fwd), "allow");
cli("r4-2 Bash redirect /tmp", bash("git log > /tmp/log.txt", fwd), "allow");
cli("r4-2 Bash redirect relative ../ climbing out", bash("echo x > ../qa235-outside/x.txt", fwd), "allow");
cli("r4-2 Write scratch outside (fwd)", write(`${outsideDir}/x.md`, fwd), "allow");
cli("r4-2 Write scratch outside (back)", write("C:\\qa-tmp\\x.md", fwd), "allow");
cli("r4-2 Edit outside look-alike …/open-brain/src/", edit(`${outsideDir}/open-brain/src/cli.ts`, fwd), "allow");
cli("r4-2 Write prefix-sharing sibling fx-x/open-brain/src (outside)", write(`${fwd}-x/open-brain/src/cli.ts`, fwd), "allow");
cli("r4-2 undeterminable `echo x > $TMP/x.txt`", bash("echo x > $TMP/x.txt", fwd), "deny");
cli("r4-2 undeterminable backtick target", bash("echo x > `pwd`/x.txt", fwd), "deny");
cli("r4-2 undeterminable ${VAR}", bash('echo x > "${HOME}/x.txt"', fwd), "deny");
cli("r4-2 undeterminable relative Write with non-absolute cwd", write("notes.md", "open-brain"), "deny");
cli("r4-2 undeterminable relative Bash with non-absolute cwd", bash("echo x > notes.md", "open-brain"), "deny");
// Tilde: the shell expands ~ to $HOME, the hook does not. $HOME/… is refused as undeterminable; ~/… is not.
cli("r4-2 TILDE `echo x > ~/qa235-fx/open-brain/src/cli.ts` (HOME=C:/qa-scratch would land in PH-1)", bash("echo x > ~/qa235-fx/open-brain/src/cli.ts", fwd), "deny");
cli("r4-2 TILDE control `echo x > $HOME/qa235-fx/open-brain/src/cli.ts`", bash("echo x > $HOME/qa235-fx/open-brain/src/cli.ts", fwd), "deny");
cli("r4-2 TILDE Write file_path ~/qa235-fx/open-brain/src/cli.ts", write("~/qa235-fx/open-brain/src/cli.ts", fwd), "deny");

// ---------- r4-3, case on a Windows drive root (real CLI) ----------
cli("r4-3 Edit abs OPEN-BRAIN/SRC/cli.ts", edit(`${fwd}/OPEN-BRAIN/SRC/cli.ts`, fwd), "deny");
cli("r4-3 Edit abs back OPEN-BRAIN\\SRC\\cli.ts", edit(`${back}\\OPEN-BRAIN\\SRC\\cli.ts`, fwd), "deny");
cli("r4-3 Edit relative OPEN-BRAIN/SRC/cli.ts (cwd=root)", edit("OPEN-BRAIN/SRC/cli.ts", fwd), "deny");
cli("r4-3 Bash redirect relative OPEN-BRAIN/SRC/cli.ts", bash("echo x > OPEN-BRAIN/SRC/cli.ts", fwd), "deny");
cli("r4-3 Bash redirect abs OPEN-BRAIN/SRC/cli.ts", bash(`echo x > ${fwd}/OPEN-BRAIN/SRC/cli.ts`, fwd), "deny");
cli("r4-3 Write .AGENTS/STATE.JSON", write(`${fwd}/.AGENTS/STATE.JSON`, fwd), "deny");
cli("r4-3 Write .agents/tasks/inbox.md", write(`${fwd}/.agents/tasks/inbox.md`, fwd), "deny");
cli("r4-3 Write Package.JSON (root)", write(`${fwd}/Package.JSON`, fwd), "deny");
cli("r4-3 Write SCRIPTS/x.sh", write(`${fwd}/SCRIPTS/x.sh`, fwd), "deny");
cli("r4-3 root case-varied C:/QA-SCRATCH/QA235-FX/open-brain/src/cli.ts", edit(`${fwd.toUpperCase()}/open-brain/src/cli.ts`, fwd), "deny");
cli("r4-3 lower-case drive c:/…/open-brain/src/cli.ts", edit(`${fwd[0].toLowerCase()}${fwd.slice(1)}/open-brain/src/cli.ts`, fwd), "deny");
cli("r4-3 cwd=OPEN-BRAIN Bash `echo x > SRC/cli.ts`", bash("echo x > SRC/cli.ts", `${fwd}/OPEN-BRAIN`), "deny");
cli("r4-3 SUMMARY upper-case Write (region absent → allow on both)", write(`${fwd}/.AGENTS/SYSTEM/summary.md`, fwd), "allow");

// ---------- r4-4..r4-6: the merge path, with a fetch recorder (runPlannerHookAsync) ----------
const PRS = { 1: ["docs/loops/x.md"], 2: ["open-brain/src/cli.ts"] };
const calls = [];
const fakeFetch = async (url) => {
  calls.push(url);
  const m = url.match(/pulls\/(\d+)(\/files)?/);
  const files = PRS[m?.[1]];
  if (!files) return { ok: false, status: 404, json: async () => ({}) };
  const page = Number(new globalThis.URL(url).searchParams.get("page") ?? "1");
  return { ok: true, status: 200, json: async () => (m[2] ? (page === 1 ? files.map((filename) => ({ filename, status: "modified" })) : []) : { changed_files: files.length }) };
};
const fetchDeps = { fetchImpl: fakeFetch, env: { GH_TOKEN: "qa235-fixture-token" }, home: "C:/qa-scratch/qa235-nohome" };
const grantFile = join(FX, "open-brain", ".planner-outward-grant");
const setGrant = (command) => writeFileSync(grantFile, JSON.stringify({ command }));
const clearGrant = () => existsSync(grantFile) && rmSync(grantFile);
async function fn(name, command, expect, extra = {}) {
  calls.length = 0;
  const r = await runPlannerHookAsync(bash(command, fwd), {}, fetchDeps);
  out[name] = { expect, got: r.decision, pass: r.decision === expect && (extra.zeroFetch ? calls.length === 0 : true), fetches: calls.length, reason: (r.reason ?? "").slice(0, 300), ...(extra.grant ? { grantPresentAfter: existsSync(grantFile) } : {}) };
}
clearGrant();
// r4-4
await fn("r4-4 `GH_REPO=other/x gh pr merge 1 --squash`", "GH_REPO=other/x gh pr merge 1 --squash", "deny", { zeroFetch: true });
await fn("r4-4 `env GH_REPO=other/x gh pr merge 1`", "env GH_REPO=other/x gh pr merge 1", "deny", { zeroFetch: true });
await fn("r4-4 `GH_HOST=evil gh pr merge 1`", "GH_HOST=evil gh pr merge 1", "deny", { zeroFetch: true });
await fn("r4-4 `GH_REPO=other/x gh.exe pr merge 1`", "GH_REPO=other/x gh.exe pr merge 1", "deny", { zeroFetch: true });
await fn("r4-4 `command gh pr merge 1`", "command gh pr merge 1", "deny", { zeroFetch: true });
await fn("r4-4 control `gh pr merge 1 --squash` (docs-only, allow after reading)", "gh pr merge 1 --squash", "allow");
// r4-5
setGrant("gh pr merge 1");
await fn("r4-5 grant `gh pr merge 1` vs `gh pr merge 1 --repo other/x`", "gh pr merge 1 --repo other/x", "deny", { grant: true, zeroFetch: true });
await fn("r4-5 grant `gh pr merge 1` vs `gh pr merge 1 -R other/x`", "gh pr merge 1 -R other/x", "deny", { grant: true, zeroFetch: true });
await fn("r4-5 grant `gh pr merge 1` vs `gh pr merge 12`", "gh pr merge 12", "deny", { grant: true });
clearGrant();
setGrant("git push origin loop/x");
await fn("r4-5 grant `git push origin loop/x` vs `… --force`", "git push origin loop/x --force", "deny", { grant: true });
await fn("r4-5 grant `git push origin loop/x` vs `… -f`", "git push origin loop/x -f", "deny", { grant: true });
await fn("r4-5 grant `git push origin loop/x` vs `… --force-with-lease`", "git push origin loop/x --force-with-lease", "deny", { grant: true });
await fn("r4-5 grant `git push origin loop/x` vs `… && git push --force origin master`", "git push origin loop/x && git push --force origin master", "deny", { grant: true });
clearGrant();
setGrant("gh pr merge 2 --squash");
await fn("r4-5 grant `gh pr merge 2 --squash` vs `  gh   pr merge 2\\t--squash ` (exact, whitespace)", "  gh   pr merge 2\t--squash ", "allow", { grant: true });
clearGrant();
setGrant("git push --force origin loop/x");
await fn("r4-5 grant `git push --force origin loop/x` vs exact", "git push --force origin loop/x", "allow", { grant: true });
clearGrant();
// r4-6
await fn("r4-6 `gh.exe pr merge 2` (code PR)", "gh.exe pr merge 2", "deny");
await fn("r4-6 `\"gh\" pr merge 2` (code PR)", '"gh" pr merge 2', "deny");
await fn("r4-6 `'gh' pr merge 2` (code PR)", "'gh' pr merge 2", "deny");
await fn("r4-6 `\"gh.exe\" pr merge 2` (code PR)", '"gh.exe" pr merge 2', "deny");
await fn("r4-6 `gh.exe pr merge 1` (docs PR, allow after reading)", "gh.exe pr merge 1", "allow");
await fn("r4-6 `\"gh\" pr merge 1` (docs PR, allow after reading)", '"gh" pr merge 1', "allow");
await fn("r4-6 `\"C:/Program Files/GitHub CLI/gh.exe\" pr merge 2` (full path)", '"C:/Program Files/GitHub CLI/gh.exe" pr merge 2', "deny");
await fn("r4-6 EXTRA `GH pr merge 2` (upper case; Git Bash on NTFS runs it)", "GH pr merge 2", "deny");
await fn("r4-6 EXTRA `gh.EXE pr merge 2`", "gh.EXE pr merge 2", "deny");
await fn("r4-6 EXTRA `gh -R other/x pr merge 1`? (flag before subcommand)", "gh --repo other/x pr merge 1", "deny");

// Regression spot checks from QA 234 (r3 rows).
await fn("REG r3-2 docs merge && force push", "gh pr merge 1 --squash && git push --force origin master", "deny", { zeroFetch: true });
await fn("REG r3-4 `gh pr merge 1 --repo=other/x`", "gh pr merge 1 --repo=other/x", "deny", { zeroFetch: true });
await fn("REG P7 force push alone", "git push --force origin master", "deny");
await fn("REG standing push loop/x", "git push origin loop/x", "allow");
cli("REG r3-1 Edit abs back src (cwd=root)", edit(`${back}\\open-brain\\src\\cli.ts`, fwd), "deny");
cli("REG r3-1 Bash redirect abs quoted back state.json (cwd=docs/loops)", bash(`echo x > "${back}\\.agents\\state.json"`, `${fwd}/docs/loops`), "deny");

writeFileSync(OUT, JSON.stringify(out, null, 2));
const rows = Object.entries(out);
for (const [k, v] of rows) console.log(`${v.pass ? "PASS" : "FAIL"}  ${k}  → ${v.got}${v.fetches !== undefined ? ` fetches=${v.fetches}` : ""}${v.grantPresentAfter !== undefined ? ` grant=${v.grantPresentAfter}` : ""}`);
console.log(`${rows.filter(([, v]) => v.pass).length}/${rows.length} as expected`);
