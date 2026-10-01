// QA 237 generator for P2b (Atlas ruling 2): `merge` and `tag` always need a grant; a push stands without one only
// when it is `origin`, every refspec is a plain branch under loop/ qa/ docs/ chore/, and there is no force, delete,
// `+`, --tags, --mirror, --all, --prune, bare push or substituted argument. A grant matches exactly (r4-5).
// Own oracle over git's argv (after bash quote and comment removal, after git's global options and -c aliases).
// Usage: node gen-p2b.mjs <out.json>
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, runAll, cli, bash, pwsh, rng, pick } from "./lib.mjs";

const FXR = makeFixture();
const R = rng(237003);
const chance = (p) => R() < p;

const GIT = ["git", "GIT", "git.exe", '"git"', "g'it'", '"C:/Program Files/Git/cmd/git.exe"'];
const GLOBALS = ["", "", "", "-C docs", "-c core.x=1", "--no-pager", "--git-dir=.git", "--git-dir .git", "-c user.name=q -C .", "--work-tree ."];
const BRANCH_OK = ["loop/x", "qa/t194-r5-y", "docs/z", "chore/w", "refs/heads/loop/q", "HEAD:loop/x", "loop/a:loop/b"];
const BRANCH_BAD = ["master", "main", "feature/x", "loopy/x", "Loop/x", "HEAD", "HEAD:master", "loop/x:master", "+loop/x", ":loop/x", "refs/tags/v1", "v1.0"];
const FLAG_OK = ["", "", "-u", "--set-upstream", "--no-verify", "-v", "--quiet", "--atomic"];
const FLAG_BAD = ["--force", "-f", "-uf", "--force-with-lease", "--force-if-includes", "--tags", "--follow-tags", "--mirror", "--all", "--prune", "--delete", "-d"];
const REMOTES = [["origin", true], ["origin", true], ["origin", true], ["upstream", false], ["ORIGIN", false], ["https://github.com/melvenac/Self-Improving-Agent.git", false]];

/** QA 237 oracle: does this git argv need a grant? */
function needsGrant(sub, remote, specs, flags, substituted) {
  if (sub === "merge" || sub === "tag") return true;
  if (sub !== "push") return false;
  if (substituted) return true;
  if (!remote || specs.length === 0) return true; // bare push / no refspec
  if (remote !== "origin") return true;
  if (flags.some((f) => FLAG_BAD.includes(f))) return true;
  for (const s of specs) {
    if (s.startsWith("+") || s.startsWith(":")) return true;
    const dst = (s.includes(":") ? s.split(":").pop() : s).replace(/^refs\/heads\//, "");
    if (!/^(loop|qa|docs|chore)\/[^\s/]/.test(dst)) return true;
  }
  return false;
}

const cases = [];
for (let n = 0; n < 300; n++) {
  const how = [];
  const g = pick(R, GIT);
  const glob = pick(R, GLOBALS);
  if (glob) how.push("global-opts");
  const kind = R();
  let words, sub, remote = null, specs = [], flags = [], substituted = false;
  if (kind < 0.12) { sub = "merge"; words = ["merge", pick(R, ["origin/master", "--no-ff x", "feature"])]; }
  else if (kind < 0.2) { sub = "tag"; words = ["tag", pick(R, ["v1", "-a v1 -m x", "-d v1"])]; }
  else if (kind < 0.3) { sub = pick(R, ["status", "log", "merge-base", "fetch", "branch", "pull"]); words = [sub, ...(sub === "merge-base" ? ["a", "b"] : [])]; how.push("non-restricted"); }
  else if (kind < 0.36) { // NEW class: an inline -c alias that is a restricted subcommand
    const [al, target, isR] = pick(R, [["m", "merge", true], ["t", "tag", true], ["fp", "push --force origin master", true], ["st", "status", false]]);
    words = [`-c`, `alias.${al}='${target}'`, al, ...(al === "m" ? ["feature"] : al === "t" ? ["v9"] : [])];
    how.length = 0; // the global options are not used in this branch
    how.push("new:inline-alias");
    cases.push({ id: `bash ${g} ${words.join(" ")}`, payload: bash(`${g} ${words.join(" ")}`, FXR), expect: isR ? "deny" : "allow", how });
    continue;
  } else {
    sub = "push";
    const [rem, isOrigin] = pick(R, REMOTES);
    if (!isOrigin) how.push("remote:not-origin");
    const bare = chance(0.05);
    remote = bare ? null : rem === "origin" ? "origin" : rem;
    const nSpecs = bare ? 0 : 1 + (chance(0.2) ? 1 : 0);
    for (let k = 0; k < nSpecs; k++) specs.push(chance(0.7) ? pick(R, BRANCH_OK) : pick(R, BRANCH_BAD));
    const f = chance(0.7) ? pick(R, FLAG_OK) : pick(R, FLAG_BAD);
    if (f) flags.push(f);
    if (chance(0.08)) { specs[0] = specs[0] ? `loop/$BR` : "loop/$BR"; substituted = true; how.push("substituted"); }
    const pos = chance(0.5) ? "before" : "after";
    words = ["push", ...(pos === "before" ? flags : []), ...(remote ? [remote] : []), ...specs, ...(pos === "after" ? flags : [])];
    if (bare) how.push("bare");
  }
  const expectGrant = needsGrant(sub, remote, specs, flags, substituted);
  let cmd = `${g} ${glob ? glob + " " : ""}${words.join(" ")}`;
  const ctx = pick(R, ["plain", "plain", "plain", "chain-after", "keyword", "comment", "ps", "subshell"]);
  how.push(`ctx:${ctx}`);
  if (ctx === "chain-after") cmd = `echo a && ${cmd}`;
  if (ctx === "keyword") cmd = `for b in 1; do ${cmd}; done`;
  if (ctx === "comment") cmd = `${cmd} # pushed`;
  if (ctx === "subshell") cmd = `(${cmd})`;
  const payload = ctx === "ps" ? pwsh(cmd.replace(/^g'it'/, "git"), FXR) : bash(cmd, FXR);
  cases.push({ id: `${ctx === "ps" ? "ps" : "bash"} ${cmd}`, payload, expect: expectGrant ? "deny" : "allow", how });
}

const res = await runAll(cases);
const rows = res.map((r) => ({ id: r.id, how: r.how, expect: r.expect, got: r.decision, pass: r.decision === r.expect, reason: r.decision === r.expect ? undefined : r.reason.slice(0, 250) }));

// Grant exactness (r4-5): a grant written for one command allows exactly that command once, and nothing near it.
const grantFile = join(FXR, "open-brain", ".planner-outward-grant");
const GRANTS = [
  ["git push --force origin loop/x", ["git push --force origin loop/x", "git  push  --force origin loop/x "], ["git push --force origin master", "git push --force origin loop/x && git tag v1", "git push --force origin loop/x # c", "git push -f origin loop/x", "GIT push --force origin loop/x"]],
  ["git merge feature", ["git merge feature"], ["git merge feature2", "git merge feature; git push --force origin master", "git -C . merge feature", "git merge  --no-ff feature"]],
  ["git tag v1", ["git tag v1"], ["git tag v2", "git tag v1 && git push --tags", "git tag -f v1"]],
];
for (const [grant, same, near] of GRANTS) {
  for (const c of [...same.map((x) => [x, "allow"]), ...near.map((x) => [x, "deny"])]) {
    writeFileSync(grantFile, JSON.stringify({ command: grant }));
    const r = await cli(bash(c[0], FXR));
    const consumed = !existsSync(grantFile);
    const pass = r.decision === c[1] && (c[1] === "allow" ? consumed : !consumed);
    rows.push({ id: `grant[${grant}] vs ${c[0]}`, how: ["grant"], expect: c[1], got: r.decision, consumed, pass, reason: pass ? undefined : r.reason.slice(0, 250) });
  }
}
if (existsSync(grantFile)) rmSync(grantFile);

const fails = rows.filter((r) => !r.pass);
const byClass = {};
for (const f of fails) for (const h of f.how) byClass[h] = (byClass[h] ?? 0) + 1;
const summary = { cases: rows.length, agree: rows.length - fails.length, disagree: fails.length,
  failOpen: fails.filter((f) => f.expect === "deny").length, failClosed: fails.filter((f) => f.expect === "allow").length, failuresByTag: byClass };
writeFileSync(process.argv[2], JSON.stringify({ summary, disagreements: fails, all: rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const f of fails) console.log(`DISAGREE expect=${f.expect} got=${f.got} ${f.id}`);
