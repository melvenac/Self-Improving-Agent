// check.mjs — runs resolve.mjs and verdicts.mjs on known inputs and prints JSON for the test to assert on.
// `open-brain/tests/pipelines/jev-cal-2-resolve.test.ts` spawns it (the tests cannot import .mjs under typecheck:tests).
//   real     three known QA runs resolved against origin (QA 258 -> b4-misc, QA 279 -> s161g, QA 255 -> b1-start)
//   fake     runs that must NOT resolve, and the fallback order, on an in-memory repository
//   verdicts parseVerdicts on small fixtures of each report shape
import { gitDeps } from "./lib.mjs";
import { resolveRun, qaRuns } from "./resolve.mjs";
import { parseVerdicts } from "./verdicts.mjs";

const real = {};
const deps = gitDeps();
for (const n of [258, 279, 255]) real[n] = resolveRun(n, deps);

/** An in-memory origin: files on master and report branches. */
function fake({ master = {}, branches = {} }) {
  return {
    masterFiles: () => Object.keys(master).filter((p) => p.startsWith("docs/loops/")).map((p) => p.slice("docs/loops/".length)),
    masterShow: (p) => master[p] ?? null,
    refExists: (ref) => Object.hasOwn(branches, ref),
    refShow: (ref, p) => branches[ref]?.[p] ?? null,
  };
}
const prompt = (n, prefix) => `Read \`docs/loops/qa-${n}-x-dispatch.md\`. You are QA ${n}, and your prefix is \`${prefix}\`. Push ONLY \`qa/${prefix}-*\`.`;
const commitLine = (prefix) => `- Commit \`docs/loops/${prefix}-qa-report.md\` with its \`.E_t.json\` on \`qa/${prefix}-report\`.`;

const fakeRuns = {
  // the prompt names a prefix, but no such branch is on origin
  branch_missing: resolveRun(901, fake({ master: { "docs/loops/qa-901-headless-prompt.md": prompt(901, "zz-nope"), "docs/loops/qa-901-x-dispatch.md": commitLine("zz-nope") } })),
  // neither a prompt nor a dispatch
  nothing_stated: resolveRun(902, fake({})),
  // a prompt with no prefix line and a dispatch with a literal <prefix>: nothing to resolve from
  no_prefix: resolveRun(903, fake({ master: { "docs/loops/qa-903-headless-prompt.md": "Read the dispatch.", "docs/loops/qa-903-x-dispatch.md": "- Commit `docs/loops/<prefix>-qa-report.md` on `qa/<prefix>-report`." } })),
  // the branch exists and holds a report under another name
  report_file_missing: resolveRun(904, fake({ master: { "docs/loops/qa-904-headless-prompt.md": prompt(904, "ab") }, branches: { "origin/qa/ab-report": { "docs/loops/other.md": "x" } } })),
  // no prompt prefix: the dispatch's Commit line is the second source
  from_dispatch: resolveRun(905, fake({ master: { "docs/loops/qa-905-headless-prompt.md": "Read the dispatch.", "docs/loops/qa-905-x-dispatch.md": commitLine("cd") }, branches: { "origin/qa/cd-report": { "docs/loops/cd-qa-report.md": "# r" } } })),
  // the prompt and the dispatch disagree: the prompt wins and the note says so
  prompt_wins: resolveRun(906, fake({ master: { "docs/loops/qa-906-headless-prompt.md": prompt(906, "ef"), "docs/loops/qa-906-x-dispatch.md": commitLine("gh") }, branches: { "origin/qa/ef-report": { "docs/loops/ef-qa-report.md": "# r" }, "origin/qa/gh-report": { "docs/loops/gh-qa-report.md": "# r" } } })),
  runs: qaRuns(fake({ master: { "docs/loops/qa-249-headless-prompt.md": "", "docs/loops/qa-250-headless-prompt.md": "", "docs/loops/qa-281-headless-prompt.md": "", "docs/loops/qa-281-s-dispatch.md": "" } }), 250),
};

const TABLE = [
  "| PR | Task | Pinned head | Verdict |", "|---|---|---|---|",
  "| #10 | T-1 | `aaaaaaa1111` | **ACCEPT** |",
  "| #11 | T-2 r2 | `bbbbbbb2222` | **REJECT** (row 3) |",
  "| #12 | T-3 | `ccccccc3333` | **ACCEPT on rows run, INCOMPLETE on row 7c** |",
  "| Batch | all | `ddddddd4444` | REJECT (because #11 is rejected) |",
].join("\n");
const LINES = [
  "## Verdicts", "",
  "- **T-5 (`eeeeeee5555`): ACCEPT.** One gap.",
  "- **T-6 (`fffffff6666`): REJECT.** Two defects.",
  "- **Pair: REJECT.**",
  "If the planner holds that reading, it overturns T-6's ACCEPT.",
].join("\n");
const SHARED_HEAD = [
  "**Candidate:** `1234567abcd` on a branch.", "",
  "- **T-8: REJECT.** Defect.", "- **T-9: ACCEPT on its own rows.**",
].join("\n");
const SHALESS = [
  "## #20, T-7 PR A (`9999999abcd`)", "", "text", "",
  "- #20: **ACCEPT**", "- `#20 r2`: **ACCEPT** at `9999999abcdef0123456789`",
].join("\n");

const RESULT = [
  "| PR | Task | Pinned head | Result | Deciding rows |", "|---|---|---|---|---|",
  "| #30 | T-9 r4 | `1111111aaaa` | **ACCEPT** | Rows 1-6 pass. |",
  "| #31 | HUBROOM | — | **FINDINGS** | no pinned head |",
  "", "| PR | Developer's mutant | Result | QA mutant | Result |", "|---|---|---|---|---|",
  "| #30 | m1 | killed | q1 | killed |",
].join("\n");

const verdicts = {
  result_column: parseVerdicts(RESULT),
  table: parseVerdicts(TABLE),
  lines: parseVerdicts(LINES),
  shared_head: parseVerdicts(SHARED_HEAD),
  head_less: parseVerdicts(SHALESS),
  empty: parseVerdicts("# a report with no verdicts\n\nINCOMPLETE\n"),
};

console.log(JSON.stringify({ real, fake: fakeRuns, verdicts }));
