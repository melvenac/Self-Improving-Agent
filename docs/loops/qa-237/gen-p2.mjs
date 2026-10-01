// QA 237 generator for P2 ("a command is a merge if gh would run `pr merge`; only one exact grammar needs no grant").
// Own oracle, written from the r5 dispatch text: bash removes quotes and comments, gh's argv decides the subcommand.
// Real built CLI with no token: an EXACT-grammar merge is READ, which without a token fails closed naming
// "no GitHub token" (no network call is possible). A non-exact merge is refused naming the grammar cause.
// A non-merge gh command is not an outward restriction and must be allowed.
// Usage: node gen-p2.mjs <out.json>
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, bash, pwsh, rng, pick } from "./lib.mjs";

const FXR = makeFixture();
const R = rng(237002);
const chance = (p) => R() < p;

const GH = [["gh", "gh"], ["GH", "GH"], ["gh.exe", "gh.exe"], ["Gh.Exe", "Gh.Exe"], ['"gh"', "gh"], ["'gh'", "gh"], ["g'h'", "gh"], ['"C:/Program Files/GitHub CLI/gh.exe"', "C:/Program Files/GitHub CLI/gh.exe"], ["\\gh", "gh"]];
const REFS = [["1", "1"], ["42", "42"], ["'#7'", "#7"], ['"#7"', "#7"], ["https://github.com/melvenac/Self-Improving-Agent/pull/3", "origin-url"],
  ["https://github.com/other/repo/pull/3", "other-url"], ["#5", null /* bash: comment */], ["feature-branch", "branch"]];
const OK_FLAGS = ["--squash", "--merge", "--rebase", "--delete-branch", "-s", "-m", "-r", "-d"];
const OTHER_FLAGS = ["--admin", "--auto", "--body=x", "-b x", "--subject s", "-sd", "--disable-auto", "--match-head-commit abc"];
const GLOBAL_PRE = ["--repo o/x", "-R o/x", "-Ro/x", "--repo=o/x"];

/** argv after bash: strip a trailing `#...` comment word and everything after it. */
const bashArgv = (words) => {
  const out = [];
  for (const w of words) { if (w.startsWith("#")) break; out.push(w); }
  return out;
};

const cases = [];
// --- merges ---
for (let n = 0; n < 260; n++) {
  const [ghS] = pick(R, GH);
  const how = [];
  const pre = chance(0.2) ? pick(R, GLOBAL_PRE) : null;
  if (pre) how.push("pre-flag");
  const mid = chance(0.1) ? pick(R, ["-R o/x", "--repo o/x"]) : null; // between pr and merge
  if (mid) how.push("mid-flag");
  const [refS, refKind] = chance(0.85) ? pick(R, REFS) : [null, "none"];
  how.push(`ref:${refKind ?? "comment"}`);
  const flags = [];
  for (let k = Math.floor(R() * 3); k > 0; k--) flags.push(chance(0.75) ? pick(R, OK_FLAGS) : pick(R, OTHER_FLAGS));
  if (flags.some((f) => !OK_FLAGS.includes(f))) how.push("other-flag");
  const prS = chance(0.1) ? "'pr'" : "pr";
  const mergeS = chance(0.1) ? '"merge"' : "merge";
  const words = [ghS, ...(pre ? [pre] : []), prS, ...(mid ? [mid] : []), mergeS, ...(refS ? [refS] : []), ...flags];
  let cmd = words.join(" ");
  const ctx = pick(R, ["plain", "plain", "plain", "env", "chain", "pipe", "redirect", "comment", "keyword", "ps"]);
  how.push(`ctx:${ctx}`);
  if (ctx === "env") cmd = `GH_REPO=o/x ${cmd}`;
  if (ctx === "chain") cmd = `${cmd} && echo ok`;
  if (ctx === "pipe") cmd = `${cmd} | cat`;
  if (ctx === "redirect") cmd = `${cmd} > C:/qa-tmp/o.txt`;
  if (ctx === "comment") cmd = `${cmd} # merge it`;
  if (ctx === "keyword") cmd = `if true; then ${cmd}; fi`;
  // ---- the oracle ----
  // What gh receives (bash argv): the ref `#5` and a trailing comment are removed by the shell.
  const argv = bashArgv(words.flatMap((w) => w.split(" ")));
  const refArg = refS && !refS.startsWith("#") ? refKind : null;
  const flagsSeen = argv.slice(argv.indexOf(mergeS) + 1 + (refArg ? 1 : 0));
  const exact = !pre && !mid && ["plain", "comment", "ps"].includes(ctx)
    && refArg !== null && ["1", "42", "#7", "origin-url"].includes(refArg) // "<N | origin pull URL>"
    && flagsSeen.every((f) => OK_FLAGS.includes(f));
  const expect = exact ? "read" : "grant";
  const payload = ctx === "ps" ? pwsh(cmd.replace(/^\\gh/, "gh"), FXR) : bash(cmd, FXR);
  cases.push({ id: `${ctx === "ps" ? "ps" : "bash"} ${cmd}`, payload, expect, how });
}
// --- non-merge gh commands: must not be swept in ---
const NON = ["pr view 5", "pr list --label merge", "pr comment 5 --body merge", "pr create --title merge --body x", "pr checks 5",
  "pr diff 5", "pr edit 5 --title merge", "issue list --search 'pr merge'", "pr view 5 --json mergeable", "pr list --state merged",
  "api repos/o/x/pulls", "pr status", "pr view 5 --comments", "search prs merge", "pr ready 5", "pr review 5 --comment -b merge"];
for (let n = 0; n < 120; n++) {
  const [ghS] = pick(R, GH);
  const rest = pick(R, NON);
  const cmd = `${ghS} ${rest}`;
  const ps = chance(0.2);
  cases.push({ id: `${ps ? "ps" : "bash"} ${cmd}`, payload: ps ? pwsh(cmd.replace(/^\\gh/, "gh"), FXR) : bash(cmd, FXR), expect: "allow", how: ["non-merge", /merge/.test(rest) ? "word:merge" : "no-merge-word"] });
}

const res = await runAll(cases);
const verdict = (r) => (r.decision === "allow" ? "allow" : /no GitHub token/.test(r.reason) ? "read" : "grant");
const rows = res.map((r) => ({ id: r.id, how: r.how, expect: r.expect, got: verdict(r), pass: verdict(r) === r.expect, reason: verdict(r) === r.expect ? undefined : r.reason.slice(0, 300) }));
const fails = rows.filter((r) => !r.pass);
const byClass = {};
for (const f of fails) for (const h of f.how) byClass[h] = (byClass[h] ?? 0) + 1;
const summary = { cases: rows.length, merges: 260, nonMerges: 120, agree: rows.length - fails.length, disagree: fails.length,
  failOpen: fails.filter((f) => f.expect === "grant").length, failClosed: fails.filter((f) => f.expect !== "grant").length, failuresByTag: byClass };
writeFileSync(process.argv[2], JSON.stringify({ summary, disagreements: fails, all: rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const f of fails) console.log(`DISAGREE expect=${f.expect} got=${f.got} ${f.id}`);
