// T-194 sparse planner checkout, SIM: node docs/loops/t194-sparse/sim.mjs <built clone root>
// Makes two linked worktrees of the clone's HEAD, one full and one sparse (cone: docs .agents .claude), and compares
// what a planner session reads and writes in each. It writes only under a fresh temp directory and the clone's
// worktree list; HOME, USERPROFILE and KNOWLEDGE_V2_DB point into that temp directory for every child.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const clone = resolve(process.argv[2] ?? ".");
const build = join(clone, "open-brain", "build");
const tmp = mkdtempSync(join(tmpdir(), "t194-sparse-"));
const home = join(tmp, "home");
mkdirSync(join(home, ".claude", "open-brain"), { recursive: true });
const env = { ...process.env, HOME: home, USERPROFILE: home, KNOWLEDGE_V2_DB: join(home, ".claude", "open-brain", "knowledge-v2.db"), NO_COLOR: "1" };
const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", env }).trim();
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const head = git(clone, ["rev-parse", "HEAD"]);
const full = join(tmp, "a", "planner");
const sparse = join(tmp, "b", "planner");
git(clone, ["worktree", "add", "-q", "--detach", full, head]);
git(clone, ["worktree", "add", "-q", "--detach", sparse, head]);
git(sparse, ["sparse-checkout", "set", "--cone", "docs", ".agents", ".claude"]);
console.log(`HEAD ${head}\nTMP ${tmp}`);
console.log(`git ${git(clone, ["--version"])}`);

// S1: the sparse tree holds the root files and the three directories, and nothing else.
const top = readdirSync(sparse).filter((e) => e !== ".git").sort();
console.log(`S1 sparse top level: ${top.join(" ")}`);
check("S1 no open-brain/, scripts/ or project-template/", !["open-brain", "scripts", "project-template"].some((d) => top.includes(d)));
check("S1 docs/, .agents/, .claude/, CLAUDE.md, package.json present", ["docs", ".agents", ".claude", "CLAUDE.md", "package.json"].every((e) => top.includes(e)));
check("S1 sparse status is clean", git(sparse, ["status", "--porcelain"]) === "", git(sparse, ["status", "--porcelain"]));

// S2: the retention and gap-id scans cite the same ids in both trees.
const sw = await import(pathToFileURL(join(build, "shared", "state-writer.js")).href);
const asText = (m) => [...m.entries()].map(([id, files]) => `${id}=${[...files].sort().join(",")}`).sort().join("\n");
const tFull = sw.citedTaskIds(full);
const tSparse = sw.citedTaskIds(sparse);
console.log(`S2 cited task ids: full ${tFull.size}, sparse ${tSparse.size}`);
check("S2 citedTaskIds identical (ids and files)", asText(tFull) === asText(tSparse));
const gFull = sw.citedGapIds(full);
const gSparse = sw.citedGapIds(sparse);
console.log(`S2 cited gap ids: full ${gFull.ok ? gFull.cited.size : gFull.reason}, sparse ${gSparse.ok ? gSparse.cited.size : gSparse.reason}`);
check("S2 citedGapIds identical", gFull.ok && gSparse.ok && asText(gFull.cited) === asText(gSparse.cited));

// S3: the CLI briefing is the same in both trees, paths aside.
const briefing = (root) => {
  const r = spawnSync(process.execPath, [join(build, "cli.js"), "start", root], { cwd: root, encoding: "utf8", env, timeout: 120_000 });
  const text = r.stdout ?? "";
  const a = text.indexOf("## Briefing");
  const b = text.indexOf("## End Briefing");
  const block = a >= 0 && b > a ? text.slice(a, b + "## End Briefing".length) : "";
  return { status: r.status, block: block.split(root).join("<ROOT>").split(root.split("\\").join("/")).join("<ROOT>"), stderr: r.stderr ?? "" };
};
const bFull = briefing(full);
const bSparse = briefing(sparse);
check("S3 both CLI starts exit 0 with a Briefing block", bFull.status === 0 && bSparse.status === 0 && bFull.block !== "" && bSparse.block !== "", `exit ${bFull.status}/${bSparse.status}`);
const lf = bFull.block.split("\n");
const ls = bSparse.block.split("\n");
const diff = [];
for (let i = 0; i < Math.max(lf.length, ls.length); i++) if (lf[i] !== ls[i]) diff.push(`  line ${i}\n    full:   ${lf[i] ?? "(none)"}\n    sparse: ${ls[i] ?? "(none)"}`);
check("S3 briefings identical", diff.length === 0, `${diff.length} differing line(s)`);
if (diff.length > 0) console.log(diff.join("\n"));
if (bSparse.stderr.trim()) console.log(`S3 sparse stderr:\n${bSparse.stderr.trim()}`);

// S4: the same record write in both trees keeps and drops the same done tasks, and leaves the same files.
const rev = JSON.parse(readFileSync(join(full, ".agents", "state.json"), "utf8")).revision;
const op = { op: "add_verified", claim: "t194 sparse sim probe", evidence: [{ type: "sim", path: "docs/loops/t194-sparse/sim.mjs", observation: "probe" }] };
const write = (root) => sw.applyStateOps(root, { session: 999, expected_revision: rev, ops: [op] });
const wFull = write(full);
const wSparse = write(sparse);
check("S4 both writes ok", wFull.ok && wSparse.ok, `${wFull.error ?? ""} ${wSparse.error ?? ""}`.trim());
const ids = (w) => `dropped [${[...(w.dropped_task_ids ?? [])].sort().join(",")}] kept ${(w.kept_cited_task_ids ?? []).length}`;
console.log(`S4 full: ${ids(wFull)}\nS4 sparse: ${ids(wSparse)}`);
check("S4 same dropped and kept task ids", JSON.stringify([...(wFull.dropped_task_ids ?? [])].sort()) === JSON.stringify([...(wSparse.dropped_task_ids ?? [])].sort())
  && JSON.stringify([...(wFull.kept_cited_task_ids ?? [])].sort()) === JSON.stringify([...(wSparse.kept_cited_task_ids ?? [])].sort()));
const changed = (root) => git(root, ["status", "--porcelain"]).split("\n").filter(Boolean).sort().join(" ");
console.log(`S4 changed files: full [${changed(full)}] sparse [${changed(sparse)}]`);
check("S4 same changed files", changed(full) === changed(sparse));

// S5: the planner's detach to another commit keeps the tree sparse.
git(sparse, ["checkout", "-q", "--", "."]);
git(sparse, ["checkout", "-q", "--detach", `${head}~1`]);
git(sparse, ["checkout", "-q", "--detach", head]);
const after = readdirSync(sparse).filter((e) => e !== ".git");
const cone = git(sparse, ["sparse-checkout", "list"]).split("\n").sort().join(" ");
check("S5 still sparse after two detaches", !after.includes("open-brain") && cone === ".agents .claude docs", cone);
check("S5 .agents/state.json present", existsSync(join(sparse, ".agents", "state.json")));

git(clone, ["worktree", "remove", "--force", full]);
git(clone, ["worktree", "remove", "--force", sparse]);
console.log(failed === 0 ? "SIM T194-SPARSE: ALL PASS" : `SIM T194-SPARSE: ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
