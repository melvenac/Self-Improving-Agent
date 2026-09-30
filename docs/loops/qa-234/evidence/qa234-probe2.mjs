// QA 234 probe 2: what the surviving mutant qa-r32-prefix would let through. Fixture only; fake fetch.
// Usage: node qa234-probe2.mjs <open-brain/build dir> <fixture dir made by qa234-probe.mjs>
const [BUILD, FX] = process.argv.slice(2);
const { runPlannerHookAsync } = await import(`file:///${BUILD}/planner-hook/run.js`);
const calls = [];
const fakeFetch = async (url) => {
  calls.push(url.replace("https://api.github.com/repos/", ""));
  const files = url.endsWith("/files?per_page=100&page=1") ? [{ filename: "docs/a.md", status: "modified" }] : [];
  return { ok: true, status: 200, json: async () => (url.includes("/files") ? files : { changed_files: 1 }) };
};
const out = {};
for (const command of [
  "GH_REPO=other/x gh pr merge 1 --squash",
  "env GH_REPO=other/x gh pr merge 1",
  "gh pr merge 1 --squash",
]) {
  calls.length = 0;
  const r = await runPlannerHookAsync(
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: FX },
    {},
    { fetchImpl: fakeFetch, env: { GH_TOKEN: "qa234-fixture-token" }, home: "C:/qa-scratch/qa234-nohome" },
  );
  out[command] = { decision: r.decision, reason: r.reason, fetches: [...calls] };
}
console.log(JSON.stringify(out, null, 1));
