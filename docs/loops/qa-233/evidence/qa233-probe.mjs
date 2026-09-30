// QA 233 probes against the candidate build (699789e1). Fixture checkout only; fake fetch; no network.
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync, statSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BUILD = process.argv[2] ?? "C:/qa-scratch/qa233-cand/open-brain/build";
const FX = "C:/qa-scratch/qa233-fx";
const { runPlannerHookAsync } = await import(`file:///${BUILD}/planner-hook/run.js`);

const URL = (n) => `https://github.com/melvenac/Self-Improving-Agent/pull/${n}`;
// Fake GitHub: PR 1 docs-only, PR 2 touches source.
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
const fetchDeps = { fetchImpl: fakeFetch, env: { GH_TOKEN: "qa233-fixture-token" }, home: "C:/qa-scratch/qa233-nohome" };
const bash = (command) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: FX });

const out = {};
async function probe(name, payload) {
  calls.length = 0;
  const r = await runPlannerHookAsync(payload, {}, fetchDeps);
  out[name] = { decision: r.decision, reason: r.reason, fetches: calls.map((c) => c.url.replace("https://api.github.com/repos/melvenac/Self-Improving-Agent", "")) };
}

await probe("P1 docs-only merge alone", bash(`gh pr merge ${URL(1)} --squash`));
await probe("P2 code merge alone", bash(`gh pr merge ${URL(2)} --squash`));
await probe("P3 docs merge && force push master", bash(`gh pr merge ${URL(1)} --squash && git push --force origin master`));
await probe("P4 docs merge && code merge", bash(`gh pr merge ${URL(1)} && gh pr merge ${URL(2)}`));
await probe("P5 docs merge ; git tag v9", bash(`gh pr merge ${URL(1)}; git tag v9 && git push --tags`));
await probe("P6 D-066 assignments.json PR", bash(`gh pr merge ${URL(3)} --squash`));
await probe("P7 force push alone (control)", bash(`git push --force origin master`));

// Grant untouched by a docs merge (bytes + mtime).
mkdirSync(join(FX, "open-brain"), { recursive: true });
const gp = join(FX, "open-brain", ".planner-outward-grant");
writeFileSync(gp, JSON.stringify({ command: `gh pr merge ${URL(2)}` }));
const before = { bytes: readFileSync(gp, "utf8"), mtime: statSync(gp).mtimeMs };
await new Promise((r) => setTimeout(r, 30));
await probe("P8 docs merge with grant present", bash(`gh pr merge ${URL(1)} --squash`));
const after = existsSync(gp) ? { bytes: readFileSync(gp, "utf8"), mtime: statSync(gp).mtimeMs } : null;
out["P8 grant file"] = { unchanged: !!after && after.bytes === before.bytes && after.mtime === before.mtime };
rmSync(gp);

// PH-1 with absolute paths, which is what Claude Code sends in file_path.
const absSrc = join(FX, "open-brain", "src", "cli.ts").replace(/\\/g, "/");
const absSrcWin = absSrc.replace(/\//g, "\\");
for (const [name, p] of [["P9 Edit absolute fwd-slash src", absSrc], ["P10 Edit absolute backslash src", absSrcWin], ["P11 Write absolute state.json", join(FX, ".agents", "state.json")], ["P12 Edit relative src (control)", "open-brain/src/cli.ts"]]) {
  await probe(name, { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: p, old_string: "a", new_string: "b" }, cwd: FX });
}
// Through the real CLI too, for the absolute path.
const cli = spawnSync(process.execPath, [join(BUILD, "cli-planner-hook.js")], {
  input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: absSrcWin, old_string: "a", new_string: "b" }, cwd: FX }),
  encoding: "utf8",
});
out["P13 CLI Edit absolute backslash src"] = { exit: cli.status, stdout: cli.stdout };
const cli2 = spawnSync(process.execPath, [join(BUILD, "cli-planner-hook.js")], {
  input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "open-brain/src/cli.ts", old_string: "a", new_string: "b" }, cwd: FX }),
  encoding: "utf8",
});
out["P14 CLI Edit relative src (control)"] = { exit: cli2.status, stdout: cli2.stdout };
// Bash writes with absolute target.
await probe("P15 Bash redirect to absolute src", bash(`echo x > ${absSrc}`));
console.log(JSON.stringify(out, null, 1));
