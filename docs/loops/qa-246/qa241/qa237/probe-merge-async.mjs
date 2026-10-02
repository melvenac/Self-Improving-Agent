// QA 237: the two P2 fail-open classes, end to end, through runPlannerHookAsync with a FAKE fetch (no network),
// as QA 235 did for its merge rows. Shows what the hook decides once the list it reads is docs-only.
// Usage: node probe-merge-async.mjs <out.json>
import { writeFileSync } from "node:fs";
import { makeFixture, BUILD, bash, pwsh } from "./lib.mjs";

const FXR = makeFixture();
const { runPlannerHookAsync } = await import(`file:///${BUILD}/planner-hook/run.js`);
// Fake GitHub: every PR on every repo is docs-only, so the only thing that decides is the grammar.
const calls = [];
const fakeFetch = async (url) => {
  calls.push(url.replace("https://api.github.com/repos/", ""));
  return { ok: true, status: 200, json: async () => (url.includes("/files") ? (url.endsWith("page=1") ? [{ filename: "docs/loops/x.md", status: "modified" }] : []) : { changed_files: 1 }) };
};
const fetchDeps = { fetchImpl: fakeFetch, env: { GH_TOKEN: "qa237-fixture-token" }, home: "C:/qa-scratch/qa246-rq237-nohome" };
const out = {};
for (const [name, payload, note] of [
  ["`gh pr merge #2` (bash)", bash("gh pr merge #2", FXR), "bash drops `#2` as a comment: gh merges the CURRENT BRANCH's PR, not PR 2"],
  ["`gh pr merge #2` (PowerShell)", pwsh("gh pr merge #2", FXR), "PowerShell drops `#2` as a comment too"],
  ["`gh pr merge https://github.com/other/repo/pull/3`", bash("gh pr merge https://github.com/other/repo/pull/3", FXR), "the grammar is <N | ORIGIN pull URL>; this merges another repository's PR"],
  ["control `gh pr merge 2`", bash("gh pr merge 2", FXR), "exact grammar, docs-only: allow after reading"],
  ["control `gh pr merge --repo other/repo 3`", bash("gh pr merge --repo other/repo 3", FXR), "the same other-repo merge spelled with --repo: refused"],
]) {
  calls.length = 0;
  const r = await runPlannerHookAsync(payload, {}, fetchDeps);
  out[name] = { decision: r.decision, fetched: [...calls], note, reason: (r.reason ?? "").slice(0, 300) };
  console.log(`${r.decision.padEnd(5)} ${name}  fetched=${calls.join(" , ")}`);
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
