// QA 235: the case-varied SUMMARY.md marked-region Write (qa-r43-summary-cs survived). Candidate function, fixture only.
// Usage: node qa235-probe-summary.mjs <open-brain/build dir> <fixture dir (already set up by qa235-probe.mjs)>
const [BUILD, FX] = process.argv.slice(2);
const { runPlannerHook } = await import(`file:///${BUILD}/planner-hook/run.js`);
const { SUMMARY_BEGIN, SUMMARY_END } = await import(`file:///${BUILD}/pipelines/state-views/index.js`);
const fwd = FX.replace(/\\/g, "/");
const existing = `# S\n${SUMMARY_BEGIN}\nold\n${SUMMARY_END}\n`;
const content = `# S\n${SUMMARY_BEGIN}\nNEW\n${SUMMARY_END}\n`;
for (const rel of [".agents/SYSTEM/SUMMARY.md", ".AGENTS/SYSTEM/summary.md"]) {
  const r = runPlannerHook({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: `${fwd}/${rel}`, content }, cwd: fwd }, { role: "planner", summaryContent: existing });
  console.log(`${rel} region rewrite → ${r.decision}`);
}
