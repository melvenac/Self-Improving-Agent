// collect.mjs — enumerate QA reports on origin and make one row per candidate SHA.
// Reads QA reports (to find the candidate and the QA number). It writes NO verdict: labels.mjs does that.
// Writes: collect.json (every field) and dispatches.json (the only file inputs.mjs may read).
import { git, writeJson } from "./lib.mjs";

const LOOPS = "docs/loops";
const refs = git(["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/qa", "refs/remotes/origin/master"]).trim().split("\n").sort();
const masterSha = git(["rev-parse", "origin/master"]).trim();

const reportPaths = new Set();
const dispatchPaths = new Set();
for (const ref of refs) {
  for (const p of git(["ls-tree", "--name-only", ref, `${LOOPS}/`], { allowFail: true })?.trim().split("\n") ?? []) {
    if (p === "") continue;
    const b = p.slice(LOOPS.length + 1);
    if (/qa-report.*\.md$/.test(b) && !/rulings/.test(b)) reportPaths.add(p);
    if (/dispatch/.test(b) && b.endsWith(".md")) dispatchPaths.add(p);
  }
}

/** The earliest commit (by commit date, then sha) that ADDED `path` on any origin ref. */
function firstAdd(path) {
  const out = git(["log", "--remotes=origin", "--diff-filter=A", "--format=%H%x09%cI", "--", path], { allowFail: true }) ?? "";
  const rows = out.trim().split("\n").filter(Boolean).map((l) => l.split("\t"));
  rows.sort((a, b) => Date.parse(a[1]) - Date.parse(b[1]) || a[0].localeCompare(b[0]));
  return rows[0] ? { commit: rows[0][0], date: rows[0][1] } : null;
}
/** The most recent commit on any origin ref that touches `path`: the report as finally written (a draft can be committed first). */
function lastTouch(path) {
  const out = git(["log", "--remotes=origin", "-1", "--format=%H", "--", path], { allowFail: true })?.trim();
  return out || null;
}
const show = (commit, path) => git(["show", `${commit}:${path}`], { allowFail: true });
const resolveCommit = (h) => {
  const out = git(["rev-parse", "--verify", "--quiet", `${h}^{commit}`], { allowFail: true });
  return out === null || out.trim() === "" ? null : out.trim();
};

const SKIP = new Set(["qa", "report", "dispatch", "dispatches"]);
const tokensOf = (name) => name.replace(/\.md$/, "").split("-").filter((t) => t !== "" && !SKIP.has(t) && !/^\d{3}$/.test(t));
const key = (name) => tokensOf(name).sort().join("|");

/** The candidate: a commit named near the top of the report by a candidate/product label. */
function candidatesOf(text) {
  const head = text.split("\n").slice(0, 60).join("\n");
  const found = [];
  const re = /(?:[Cc]andidates?|[Pp]roduct|[Cc]ode|tip)\b[^\n`]{0,60}?`+([0-9a-f]{7,40})`/g;
  let m;
  while ((m = re.exec(head)) !== null) found.push(m[1]);
  const v = /\b(?:ACCEPT|REJECT)\*{0,2}\s+`([0-9a-f]{7,40})`/.exec(head);
  if (v) found.push(v[1]);
  return [...new Set(found.map(resolveCommit).filter(Boolean))];
}

function qaNumberOf(text) {
  const m = /\bQA[ -]?(\d{2,3})\b/.exec(text.split("\n").slice(0, 6).join("\n"));
  return m ? Number(m[1]) : null;
}

/** Among several dispatches, the one the report cites first by file name; else the only qa-NNN-named one. */
function resolveAmbiguous(options, text) {
  const cited = options
    .map((p) => ({ p, at: text.indexOf(p.slice(LOOPS.length + 1)) }))
    .filter((x) => x.at >= 0)
    .sort((x, y) => x.at - y.at);
  if (cited.length > 0) return cited[0].p;
  const numbered = options.filter((p) => /\/qa-\d{3}-/.test(p));
  return numbered.length === 1 ? numbered[0] : null;
}

function dispatchFor(reportBase, text, qaNo) {
  const rkey = key(reportBase);
  const same = [...dispatchPaths].sort().filter((p) => key(p.slice(LOOPS.length + 1)) === rkey);
  const numbered = same.filter((p) => qaNo !== null && p.includes(`qa-${qaNo}-`));
  const pick = numbered.length > 0 ? numbered : same;
  if (pick.length === 1) return { path: pick[0], how: "name" };
  if (pick.length > 1) {
    const r = resolveAmbiguous(pick, text);
    return r ? { path: r, how: "name+cited" } : { path: null, how: "ambiguous-name" };
  }
  const mentioned = [...new Set(text.match(/[\w.-]*dispatch[\w.-]*\.md/g) ?? [])]
    .map((n) => `${LOOPS}/${n}`)
    .filter((p) => dispatchPaths.has(p) && !/session-147|cal2?-a12/.test(p));
  if (mentioned.length === 1) return { path: mentioned[0], how: "mentioned" };
  if (mentioned.length > 1) {
    const r = resolveAmbiguous(mentioned, text);
    return r ? { path: r, how: "mentioned+cited" } : { path: null, how: "ambiguous-mention" };
  }
  return { path: null, how: "none" };
}

const rows = [];
const unusable = [];
for (const report of [...reportPaths].sort()) {
  const add = firstAdd(report);
  if (!add) { unusable.push({ report, reason: "no-add-commit" }); continue; }
  const last = lastTouch(report) ?? add.commit;
  const text = show(last, report) ?? "";
  const base = report.slice(LOOPS.length + 1);
  const cands = candidatesOf(text);
  const qaNo = qaNumberOf(text);
  const d = dispatchFor(base, text, qaNo);
  if (cands.length === 0) { unusable.push({ report, reason: "no-candidate-commit-named" }); continue; }
  if (d.path === null) { unusable.push({ report, reason: `no-dispatch (${d.how})`, candidate: cands[0] }); continue; }
  const dAdd = firstAdd(d.path);
  if (!dAdd) { unusable.push({ report, reason: "dispatch-without-add-commit" }); continue; }
  rows.push({
    case_id: base.replace(/\.md$/, "").replace(/-qa-report/, "").replace(/^loop-15-slice-3-/, "s3-"),
    candidate_sha: cands[0],
    other_candidates_named: cands.slice(1),
    qa_no: qaNo ?? (/qa-(\d{3})-/.exec(d.path) ? Number(/qa-(\d{3})-/.exec(d.path)[1]) : null),
    dispatch_path: d.path,
    dispatch_how: d.how,
    dispatch_commit: dAdd.commit,
    dispatch_commit_date: dAdd.date,
    dispatch_blob: git(["rev-parse", `${dAdd.commit}:${d.path}`]).trim(),
    qa_report_ref: { path: report, commit: last, first_commit: add.commit, commit_date: add.date },
    ruling_ref: null,
  });
}

// One row per candidate SHA: where two reports name the same candidate, the earlier report stays.
rows.sort((a, b) => a.qa_report_ref.commit_date.localeCompare(b.qa_report_ref.commit_date) || a.case_id.localeCompare(b.case_id));
const seen = new Set();
const cases = [];
for (const r of rows) {
  if (seen.has(r.candidate_sha)) { unusable.push({ report: r.qa_report_ref.path, reason: "duplicate-candidate", candidate: r.candidate_sha }); continue; }
  seen.add(r.candidate_sha);
  cases.push(r);
}
cases.forEach((c, i) => { c.case_no = i + 1; });

// merge_commit and base_sha: what `harness shadow-done` needs. Pure git; no verdict is read.
//  merged candidate : merge_commit is the first-parent commit on origin/master that brought it in, base = merge-base(candidate, merge^1).
//  unmerged         : merge_commit = the candidate itself; base = merge-base(candidate, origin/master as of the candidate's commit date).
//  a stacked round  : when another case of the same family is an ancestor, base = the nearest such ancestor (the round's own delta).
const family = (id) => id.replace(/^s3-a\d+$/, "s3-a").replace(/-r\d+[a-z]?$/, "");
const isAncestor = (a, b) => git(["merge-base", "--is-ancestor", a, b], { allowFail: true }) !== null;
for (const c of cases) {
  const cand = c.candidate_sha;
  const onMaster = isAncestor(cand, "origin/master");
  let merge = null;
  if (onMaster) {
    const chain = git(["rev-list", "--first-parent", "--ancestry-path", `${cand}..origin/master`], { allowFail: true })?.trim().split("\n").filter(Boolean) ?? [];
    merge = chain.length > 0 ? chain[chain.length - 1] : null;
  }
  c.merged = merge !== null;
  c.merge_commit = merge ?? cand;
  let base = null;
  if (merge !== null) {
    const parent = git(["rev-parse", `${merge}^1`], { allowFail: true })?.trim();
    base = parent ? git(["merge-base", cand, parent], { allowFail: true })?.trim() ?? null : null;
  } else {
    const date = git(["log", "-1", "--format=%cI", cand]).trim();
    const tip = git(["rev-list", "-1", "--first-parent", `--before=${date}`, "origin/master"], { allowFail: true })?.trim();
    base = tip ? git(["merge-base", cand, tip], { allowFail: true })?.trim() ?? null : null;
  }
  const stacked = cases
    .filter((o) => o !== c && family(o.case_id) === family(c.case_id) && o.candidate_sha !== cand && isAncestor(o.candidate_sha, cand))
    .map((o) => ({ sha: o.candidate_sha, n: Number(git(["rev-list", "--count", `${o.candidate_sha}..${cand}`]).trim()) }))
    .sort((x, y) => x.n - y.n);
  // The runner's diffstat is `git diff --name-only base candidate` (two-dot), so a base from before a master merge
  // lists master's files too. Of the available bases, take the one with the shorter list; a tie goes to the round's delta.
  const own = merge !== null ? "merge-parent" : "master-at-candidate-date";
  const options = [];
  if (stacked.length > 0) options.push({ how: "stacked-on-previous-round", sha: stacked[0].sha });
  if (base) options.push({ how: own, sha: base });
  for (const o of options) o.paths = git(["diff", "--name-only", "--no-renames", o.sha, cand]).trim().split("\n").filter(Boolean).length;
  options.sort((x, y) => x.paths - y.paths);
  c.base_how = options[0]?.how ?? "none";
  c.base_sha = options[0]?.sha ?? null;
  c.base_options = options.map((o) => ({ how: o.how, sha: o.sha, paths: o.paths }));
}

writeJson("collect.json", { origin_master: masterSha, refs, cases, unusable: unusable.sort((a, b) => a.report.localeCompare(b.report)) });
writeJson("dispatches.json", cases.map((c) => ({ case_id: c.case_id, case_no: c.case_no, dispatch_path: c.dispatch_path, dispatch_commit: c.dispatch_commit, dispatch_blob: c.dispatch_blob })));
console.log(`collect: ${cases.length} case(s), ${unusable.length} unusable report(s)`);
