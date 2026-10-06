// resolve.mjs — find the QA report of a QA run from the run's OWN text, never from a file name.
//
// A QA run's report branch is named by the PREFIX its prompt states ("You are QA 258, and your prefix is `b4-misc`"),
// and that prefix often differs from the dispatch's file name (qa-258-b4-dispatch.md reports on qa/b4-misc-report).
// Order, per atlas s162:
//   1. the headless prompt's line naming the prefix;
//   2. else the dispatch's "Commit `docs/loops/X-qa-report.md` ... on `qa/X-report`" line;
//   then the branch must exist on origin and the report file must exist on it. A run that cannot be resolved is
//   returned with the reason it could not. Nothing here guesses.
//
// Pure with respect to git: every read goes through `deps`, so a test can hand it a fake and a real run alike.
//   deps.masterFiles()            -> basenames under docs/loops on origin/master
//   deps.masterShow(path)         -> text of a file on origin/master, or null
//   deps.refExists(ref)           -> boolean
//   deps.refShow(ref, path)       -> text of a file on a ref, or null

export const LOOPS = "docs/loops";
const PROMPT_PREFIX = /your prefix is\s+\*{0,2}`([^`]+)`/i;
const PROMPT_DISPATCH = /`(docs\/loops\/qa-\d{3}-[^`]*dispatch[^`]*\.md)`/;
const COMMIT_LINE = /Commit\b[^\n]*?`(docs\/loops\/[^`]+?\.md)`[^\n]*?`qa\/([^`]+)-report`/;
const COMMIT_LINE_REPORT_FIRST = /Commit\b[^\n]*?`(docs\/loops\/[^`]+?\.md)`[^\n]*?\bto\s+`qa\/([^`]+)-report`/;

/** QA numbers that have a headless prompt on master, ascending, from `minQa` up to the highest. */
export function qaRuns(deps, minQa) {
  const nums = new Set();
  for (const f of deps.masterFiles()) {
    const m = /^qa-(\d{3})-headless-prompt\.md$/.exec(f);
    if (m && Number(m[1]) >= minQa) nums.add(Number(m[1]));
  }
  return [...nums].sort((a, b) => a - b);
}

/** Dispatch files of a run: the one its prompt names if it is on master, then every qa-N-*-dispatch*.md of its own number. */
function dispatchesOf(n, promptText, deps) {
  const files = deps.masterFiles();
  const out = [];
  const named = promptText ? PROMPT_DISPATCH.exec(promptText)?.[1] : null;
  if (named && deps.masterShow(named) !== null) out.push(named);
  for (const f of files) {
    if (new RegExp(`^qa-${n}-.*dispatch.*\\.md$`).test(f) && !out.includes(`${LOOPS}/${f}`)) out.push(`${LOOPS}/${f}`);
  }
  return out;
}

/**
 * @returns {{ qa_no: number, resolved: boolean, prefix: string|null, prefix_source: string|null, branch: string|null,
 *   report_path: string|null, dispatch_paths: string[], notes: string[], reason: string|null }}
 */
export function resolveRun(n, deps) {
  const promptPath = `${LOOPS}/qa-${n}-headless-prompt.md`;
  const promptText = deps.masterShow(promptPath);
  const dispatch_paths = dispatchesOf(n, promptText, deps);
  const base = { qa_no: n, resolved: false, prefix: null, prefix_source: null, branch: null, report_path: null, dispatch_paths, notes: [], reason: null };
  const fail = (reason) => ({ ...base, reason });

  let prefix = null;
  let prefix_source = null;
  const fromPrompt = promptText ? PROMPT_PREFIX.exec(promptText)?.[1] ?? null : null;
  if (fromPrompt) { prefix = fromPrompt; prefix_source = "headless-prompt"; }

  // The dispatch's own Commit line: it names the report path and the branch, possibly with a literal <prefix>.
  let commitLine = null;
  for (const p of dispatch_paths) {
    const text = deps.masterShow(p) ?? "";
    const m = COMMIT_LINE.exec(text) ?? COMMIT_LINE_REPORT_FIRST.exec(text);
    if (m) { commitLine = { path: m[1], branchPrefix: m[2], from: p }; break; }
  }
  if (prefix === null && commitLine && !commitLine.branchPrefix.includes("<")) {
    prefix = commitLine.branchPrefix;
    prefix_source = `dispatch-commit-line (${commitLine.from})`;
  }
  const notes = [];
  if (prefix !== null && commitLine && !commitLine.branchPrefix.includes("<") && commitLine.branchPrefix !== prefix) {
    notes.push(`the dispatch's Commit line names qa/${commitLine.branchPrefix}-report; the prompt's prefix \`${prefix}\` wins`);
  }
  if (prefix === null) {
    return fail(promptText === null && dispatch_paths.length === 0
      ? "no headless prompt and no dispatch on origin/master for this QA number"
      : "no prefix stated: the prompt has no \"your prefix is\" line and no dispatch has a Commit line naming qa/<prefix>-report");
  }

  const branch = `origin/qa/${prefix}-report`;
  if (!deps.refExists(branch)) return { ...base, prefix, prefix_source, branch, notes, reason: `branch missing: ${branch} is not on origin` };

  // The report path: the dispatch's Commit line when it names this branch, else the convention docs/loops/<prefix>-qa-report.md.
  const wantedByDispatch = commitLine && (commitLine.branchPrefix === prefix || commitLine.branchPrefix.includes("<"))
    ? commitLine.path.replace("<prefix>", prefix) : null;
  const candidates = [...new Set([...(wantedByDispatch ? [wantedByDispatch] : []), `${LOOPS}/${prefix}-qa-report.md`])];
  for (const path of candidates) {
    if (deps.refShow(branch, path) !== null) {
      return { ...base, resolved: true, prefix, prefix_source, branch, report_path: path, notes, reason: null };
    }
  }
  return { ...base, prefix, prefix_source, branch, notes, reason: `report file missing: none of ${candidates.join(", ")} is on ${branch}` };
}
