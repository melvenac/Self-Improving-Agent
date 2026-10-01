// QA 243, R3-2: generate the s01..s04 mutant diffs. Each wires a G_done read into prepareShadowVerdict
// (open-brain/src/harness/shadow-merge.ts) from a different place, by string replacement in the candidate tree;
// `git diff` is saved, then the file is restored and the tree proven clean.
// Usage: node qa243-make-s-mutants.mjs <candidate tree> <out dir>
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [tree, outDir] = process.argv.slice(2);
const FILE = "open-brain/src/harness/shadow-merge.ts";
const git = (...a) => {
  const r = spawnSync("git", ["-C", tree, ...a], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
const ANCHOR = "export function prepareShadowVerdict(input: {";
const CALL = "    doneGate: input.doneGate ?? null,";
const verdictOf = `const verdictOf = (rec: { verdict?: string; decision?: { verdict?: string } | null }): string | undefined => rec.verdict ?? rec.decision?.verdict ?? undefined;\n`;
const mutants = [
  {
    file: "s01-done-gate-read-from-loop-named-records-dir.diff",
    fn: `function sliceDoneRecord(repo: string, loop: string): { verdict: string } | null {
  // a records directory under a different name: loop-<loop>-records, not loop-15-slice-4-records
  const p = join(repo, "docs", "loops", \`loop-\${loop}-records\`, \`\${loop}.G_done.json\`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as { verdict: string }) : null;
}`,
  },
  {
    file: "s02-done-gate-glob-over-docs-loops.diff",
    fn: `${verdictOf}function sliceDoneRecord(repo: string, _loop: string): { verdict: string } | null {
  // a glob over docs/loops/**/*G_done*
  const walk = (d: string): string[] =>
    existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : /G_done/.test(e.name) ? [join(d, e.name)] : [])) : [];
  for (const p of walk(join(repo, "docs", "loops"))) {
    const v = verdictOf(JSON.parse(readFileSync(p, "utf8")));
    if (v === "reject" || v === "halt") return { verdict: v };
  }
  return null;
}`,
  },
  {
    file: "s03-done-gate-runner-named-records-only.diff",
    fn: `${verdictOf}function sliceDoneRecord(repo: string, _loop: string): { verdict: string } | null {
  // only the 4.3 runner's own file names (<stem>.G_done.<timestamp>.json) in its default directory, read from the working tree
  const dir = join(repo, "docs", "loops", "loop-15-slice-4-records");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^pr-\\d+\\.G_done\\.\\d{4}-.*\\.json$/.test(f)) : [];
  for (const f of files) {
    const v = verdictOf(JSON.parse(readFileSync(join(dir, f), "utf8")));
    if (v === "reject" || v === "halt") return { verdict: v };
  }
  return null;
}`,
  },
  {
    file: "s04-done-gate-read-from-committed-records.diff",
    fn: `${verdictOf}function sliceDoneRecord(repo: string, _loop: string): { verdict: string } | null {
  // the runner's own directory, read from the COMMITTED tree (HEAD), as the criteria are read from git
  const dir = "docs/loops/loop-15-slice-4-records";
  const ls = gitTry(repo, ["ls-tree", "--name-only", "HEAD", \`\${dir}/\`]);
  if (!ls.ok) return null;
  for (const p of ls.stdout.split("\\n").filter((l) => /\\.G_done\\./.test(l))) {
    const shown = gitTry(repo, ["show", \`HEAD:\${p}\`]);
    if (!shown.ok) continue;
    const v = verdictOf(JSON.parse(shown.stdout));
    if (v === "reject" || v === "halt") return { verdict: v };
  }
  return null;
}`,
  },
];
if (git("status", "--porcelain") !== "") throw new Error("tree not clean at start");
const original = readFileSync(join(tree, FILE), "utf8");
if (!original.includes(ANCHOR) || !original.includes(CALL)) throw new Error("anchors not found");
for (const m of mutants) {
  const text = original.replace(ANCHOR, `${m.fn}\n\n${ANCHOR}`).replace(CALL, "    doneGate: input.doneGate ?? sliceDoneRecord(input.repo, input.loop),");
  writeFileSync(join(tree, FILE), text);
  writeFileSync(join(outDir, m.file), git("diff", "--", FILE));
  writeFileSync(join(tree, FILE), original);
  console.log(`wrote ${m.file}`);
}
console.log(`tree clean: ${git("status", "--porcelain") === ""}`);
