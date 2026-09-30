// QA 234 probes against a planner-hook build. Fixture checkout only; fake fetch; no network.
// Usage: node qa234-probe.mjs <open-brain/build dir> <fixture dir>
// Re-runs QA 233's P1-P15 (P3, P4, P6-P15 required) and adds QA 234's own rows (Q*).
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync, statSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const BUILD = process.argv[2];
const FX = process.argv[3];
const { runPlannerHookAsync } = await import(`file:///${BUILD}/planner-hook/run.js`);

// Fixture checkout: repo-root markers, planner role, origin remote. Nothing inherited from the real repo.
for (const d of [".agents/SYSTEM", ".agents/TASKS", "open-brain/src", "docs/loops", ".git"]) mkdirSync(join(FX, d), { recursive: true });
writeFileSync(join(FX, "package.json"), '{"name":"qa234-fx"}\n');
writeFileSync(join(FX, "open-brain", "package.json"), '{"name":"open-brain"}\n');
writeFileSync(join(FX, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n');
writeFileSync(join(FX, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\n---\n");

const URL = (n) => `https://github.com/melvenac/Self-Improving-Agent/pull/${n}`;
// Fake GitHub: PR 1 docs-only, PR 2 touches source, PR 3 D-066.
const PRS = {
  1: [{ filename: "docs/loops/x.md", status: "modified" }],
  2: [{ filename: "open-brain/src/cli.ts", status: "modified" }],
  3: [{ filename: ".agents/assignments.json", status: "modified" }],
};
const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, auth: init.headers.Authorization });
  const m = url.match(/pulls\/(\d+)(\/files)?/);
  const files = PRS[m[1]];
  if (!files) return { ok: false, status: 404, json: async () => ({}) };
  const page = Number(new globalThis.URL(url).searchParams.get("page") ?? "1");
  return { ok: true, status: 200, json: async () => (m[2] ? (page === 1 ? files : []) : { changed_files: files.length }) };
};
const fetchDeps = { fetchImpl: fakeFetch, env: { GH_TOKEN: "qa234-fixture-token" }, home: "C:/qa-scratch/qa234-nohome" };
const bash = (command, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd });
const edit = (file_path, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path, old_string: "a", new_string: "b" }, cwd });
const write = (file_path, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path, content: "{}" }, cwd });

const out = {};
const short = (u) => u.replace("https://api.github.com/repos/", "");
async function probe(name, payload) {
  calls.length = 0;
  const r = await runPlannerHookAsync(payload, {}, fetchDeps);
  out[name] = { decision: r.decision, reason: r.reason, fetches: calls.map((c) => short(c.url)) };
}
function cli(name, payload, cwd) {
  // The real built CLI, a built env (no inherited GH_TOKEN etc.), run from `cwd`.
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp", HOME: "C:/qa-scratch/qa234-nohome", USERPROFILE: "C:/qa-scratch/qa234-nohome" };
  const r = spawnSync(process.execPath, [join(BUILD, "cli-planner-hook.js")], { input: JSON.stringify(payload), encoding: "utf8", env, cwd });
  out[name] = { exit: r.status, stdout: r.stdout.trim().slice(0, 400) };
}
const grantFile = join(FX, "open-brain", ".planner-outward-grant");
const setGrant = (command) => writeFileSync(grantFile, JSON.stringify({ command }));
const clearGrant = () => existsSync(grantFile) && rmSync(grantFile);
clearGrant();

// ---- QA 233's probes ----
await probe("P1 docs-only merge alone", bash(`gh pr merge ${URL(1)} --squash`));
await probe("P2 code merge alone", bash(`gh pr merge ${URL(2)} --squash`));
await probe("P3 docs merge && force push master", bash(`gh pr merge ${URL(1)} --squash && git push --force origin master`));
await probe("P4 docs merge && code merge", bash(`gh pr merge ${URL(1)} && gh pr merge ${URL(2)}`));
await probe("P5 docs merge ; git tag v9", bash(`gh pr merge ${URL(1)}; git tag v9 && git push --tags`));
await probe("P6 D-066 assignments.json PR", bash(`gh pr merge ${URL(3)} --squash`));
await probe("P7 force push alone (control)", bash(`git push --force origin master`));
setGrant(`gh pr merge ${URL(2)}`);
const before = { bytes: readFileSync(grantFile, "utf8"), mtime: statSync(grantFile).mtimeMs };
await new Promise((r) => setTimeout(r, 30));
await probe("P8 docs merge with grant present", bash(`gh pr merge ${URL(1)} --squash`));
const after = existsSync(grantFile) ? { bytes: readFileSync(grantFile, "utf8"), mtime: statSync(grantFile).mtimeMs } : null;
out["P8 grant file"] = { unchanged: !!after && after.bytes === before.bytes && after.mtime === before.mtime };
clearGrant();

const fwd = FX.replace(/\\/g, "/");
const back = fwd.replace(/\//g, "\\");
await probe("P9 Edit absolute fwd-slash src", edit(`${fwd}/open-brain/src/cli.ts`));
await probe("P10 Edit absolute backslash src", edit(`${back}\\open-brain\\src\\cli.ts`));
await probe("P11 Write absolute state.json", write(join(FX, ".agents", "state.json")));
await probe("P12 Edit relative src (control)", edit("open-brain/src/cli.ts"));
cli("P13 CLI Edit absolute backslash src", edit(`${back}\\open-brain\\src\\cli.ts`), FX);
cli("P14 CLI Edit relative src (control)", edit("open-brain/src/cli.ts"), FX);
await probe("P15 Bash redirect to absolute src", bash(`echo x > ${fwd}/open-brain/src/cli.ts`));

// ---- QA 234: r3-1 (D1), both slash forms, cwd = root and cwd != root, through the CLI ----
const sub = join(FX, "open-brain");
const docsSub = join(FX, "docs", "loops");
for (const [cwdName, cwd] of [["root", FX], ["open-brain", sub], ["docs/loops", docsSub]]) {
  cli(`Q1 CLI cwd=${cwdName} Edit abs fwd src`, edit(`${fwd}/open-brain/src/cli.ts`, cwd), cwd);
  cli(`Q1 CLI cwd=${cwdName} Edit abs back src`, edit(`${back}\\open-brain\\src\\cli.ts`, cwd), cwd);
  cli(`Q1 CLI cwd=${cwdName} Write abs fwd state.json`, write(`${fwd}/.agents/state.json`, cwd), cwd);
  cli(`Q1 CLI cwd=${cwdName} Write abs back INBOX`, write(`${back}\\.agents\\TASKS\\INBOX.md`, cwd), cwd);
  cli(`Q1 CLI cwd=${cwdName} Bash redirect abs fwd src`, bash(`echo x > ${fwd}/open-brain/src/cli.ts`, cwd), cwd);
  cli(`Q1 CLI cwd=${cwdName} Bash redirect abs back (quoted) state.json`, bash(`echo x > "${back}\\.agents\\state.json"`, cwd), cwd);
  cli(`Q1 CLI cwd=${cwdName} Write abs docs/loops (control, allow)`, write(`${fwd}/docs/loops/q.md`, cwd), cwd);
}
// Outside the repo, a sibling that shares the prefix, and an unrelocatable form: denied with a cause.
cli("Q2 CLI Edit outside repo (sibling dir)", edit(`${dirname(fwd)}/qa234-other/x.md`), FX);
cli("Q2 CLI Edit prefix-sharing sibling fx-x/open-brain/src", edit(`${fwd}-x/open-brain/src/cli.ts`), FX);
cli("Q2 CLI Write UNC path", write(`\\\\localhost\\c$\\qa-scratch\\qa234-fx\\open-brain\\src\\cli.ts`), FX);
cli("Q2 CLI Bash redirect outside repo", bash(`echo x > ${dirname(fwd)}/qa234-other/x.txt`), FX);
await probe("Q2 Edit relative climbing out", edit("../qa234-other/x.md"));
// Git Bash form and the other statically detected writers.
await probe("Q3 Bash redirect /c/ form src", bash(`echo x > /${fwd[0].toLowerCase()}${fwd.slice(2)}/open-brain/src/cli.ts`));
await probe("Q3 sed -i abs back src", bash(`sed -i s/a/b/ "${back}\\open-brain\\src\\cli.ts"`));
await probe("Q3 tee abs fwd state.json", bash(`echo {} | tee ${fwd}/.agents/state.json`));
await probe("Q3 cp abs fwd scripts", bash(`cp docs/x.sh ${fwd}/scripts/x.sh`));
await probe("Q3 mv abs back package.json", bash(`mv x.json "${back}\\package.json"`));
await probe("Q3 NotebookEdit abs src", { hook_event_name: "PreToolUse", tool_name: "NotebookEdit", tool_input: { notebook_path: `${fwd}/open-brain/tests/x.ipynb` }, cwd: FX });
// cwd != root with a RELATIVE Bash target: the shell resolves it against cwd, not the root.
await probe("Q4 cwd=open-brain Bash redirect relative src/cli.ts", bash("echo x > src/cli.ts", sub));
await probe("Q4 cwd=open-brain sed -i relative src/cli.ts", bash("sed -i s/a/b/ src/cli.ts", sub));
await probe("Q4 cwd=.agents Bash redirect relative state.json", bash("echo {} > state.json", join(FX, ".agents")));
await probe("Q4 cwd=open-brain Edit relative src/cli.ts", edit("src/cli.ts", sub));
// Case: Windows paths are case-insensitive.
await probe("Q5 Edit abs, case-varied inside repo (OPEN-BRAIN/SRC)", edit(`${fwd}/OPEN-BRAIN/SRC/cli.ts`));
await probe("Q5 Edit abs, case-varied drive/root only", edit(`${fwd.toUpperCase().slice(0, fwd.lastIndexOf("/"))}${fwd.slice(fwd.lastIndexOf("/"))}/open-brain/src/cli.ts`));

// ---- r3-2 (D2) ----
const D = URL(1), C = URL(2);
for (const [name, cmd] of [
  ["&&", `gh pr merge ${D} --squash && git push --force origin master`],
  ["&& no spaces", `gh pr merge ${D} --squash&&git push --force origin master`],
  ["||", `gh pr merge ${D} || git push --force origin master`],
  [";", `gh pr merge ${D} ; git push --force origin master`],
  ["|", `gh pr merge ${D} | sh`],
  ["newline", `gh pr merge ${D}\ngit push --force origin master`],
  ["CRLF", `gh pr merge ${D}\r\ngit push --force origin master`],
  ["$()", `gh pr merge ${D} --body "$(git push --force origin master)"`],
  ["backticks", `gh pr merge ${D} --body \`git push --force origin master\``],
  ["& (background)", `gh pr merge ${D} & gh pr merge ${C}`],
  ["subshell", `(gh pr merge ${D}) && gh pr merge ${C}`],
  ["docs && code", `gh pr merge ${D} && gh pr merge ${C}`],
  ["prefixed", `cd /tmp && gh pr merge ${D}`],
]) {
  await probe(`Q6 D2 ${name}`, bash(cmd));
}
await probe("Q6 D2 single docs merge, flags (control, allow)", bash(`gh pr merge ${D} --squash --delete-branch`));
await probe("Q6 D2 single docs merge, number ref (control, allow)", bash(`gh pr merge 1 --squash`));

// ---- r3-3 grant single invocation ----
setGrant("gh pr merge 5");
await probe("Q7 grant 'gh pr merge 5' vs '&& git push --force origin master'", bash("gh pr merge 5 && git push --force origin master"));
out["Q7 grant left unconsumed"] = { present: existsSync(grantFile) };
await probe("Q7 grant 'gh pr merge 5' vs '; git tag v9'", bash("gh pr merge 5; git tag v9"));
await probe("Q7 grant 'gh pr merge 5' vs '| sh'", bash("gh pr merge 5 | sh"));
await probe("Q7 grant 'gh pr merge 5' vs newline", bash("gh pr merge 5\ngit push --force origin master"));
out["Q7 grant still present after 4 refusals"] = { present: existsSync(grantFile) };
await probe("Q7 grant 'gh pr merge 5' vs 'gh pr merge 5 --squash' (control, allow)", bash("gh pr merge 5 --squash"));
out["Q7 grant consumed by its own invocation"] = { present: existsSync(grantFile) };
clearGrant();
setGrant("gh pr merge 5");
await probe("Q7 grant 'gh pr merge 5' vs 'gh pr merge 50'", bash("gh pr merge 50"));
clearGrant();

// ---- r3-4 --repo ----
for (const cmd of [
  "gh pr merge 1 --repo other/x",
  "gh pr merge 1 --repo=other/x",
  "gh pr merge 1 -R other/x",
  "gh pr merge 1 -Rother/x",
  "gh pr merge --repo other/x 1",
  "gh pr merge -R other/x 1 --squash",
]) {
  await probe(`Q8 ${cmd}`, bash(cmd));
}
await probe("Q8 URL of another repo (reads that repo, not origin)", bash("gh pr merge https://github.com/other/x/pull/1"));
setGrant("gh pr merge 1");
await probe("Q8 grant 'gh pr merge 1' vs 'gh pr merge 1 --repo other/x' (observation)", bash("gh pr merge 1 --repo other/x"));
clearGrant();

// ---- observations (not scored rows): r1-scope evasions and the new outside-repo deny ----
await probe("O1 gh.exe pr merge 2", bash("gh.exe pr merge 2 --squash"));
await probe("O1 quoted \"gh\" pr merge 2", bash('"gh" pr merge 2 --squash'));
setGrant("git push origin loop/x");
await probe("O2 grant 'git push origin loop/x' vs '... --force'", bash("git push origin loop/x --force"));
clearGrant();
await probe("O3 stderr to a scratch log outside the repo", bash("npm test 2> C:/qa-tmp/log.txt"));
await probe("O3 redirect to /tmp", bash("git log > /tmp/log.txt"));

console.log(JSON.stringify(out, null, 1));
