// QA 237's own mutants: one or more per property, none of them in Forge's 50. Each is a single text replacement in
// the candidate source; this writes its diff and restores the tree. Usage: node make-qa-mutants.mjs <worktree> <outdir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [WT, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOOK = "open-brain/src/planner-hook";
export const QA_MUTANTS = [
  { name: "qa-p1-outside-refused", clause: "P1 'only if': a write landing outside the repo is allowed", file: `${HOOK}/paths.ts`,
    from: `  if (rel.outside) return { kind: "ok" };`, to: `  if (rel.outside) return { kind: "refused", cause: \`\${text} (outside)\` };` },
  { name: "qa-p1-install-ignored", clause: "P1 targets: install (named in BASH_WRITE_LIMIT as covered)", file: `${HOOK}/bash.ts`,
    from: `    case "install":\n`, to: `` },
  { name: "qa-p2-one-unchecked-word", clause: "P2 exact grammar: every word after the ref is an allowed flag", file: `${HOOK}/git.ts`,
    from: `rest.slice(1).every((w) => GH_NO_GRANT_FLAGS.has(w.text))`, to: `rest.slice(2).every((w) => GH_NO_GRANT_FLAGS.has(w.text))` },
  { name: "qa-p2b-prune-allowed", clause: "P2b ruling 2: --prune needs a grant", file: `${HOOK}/git.ts`,
    from: `"--all", "--prune", `, to: `"--all", ` },
  { name: "qa-p3-comma-list-off", clause: "P3 targets: an unquoted comma list is several targets", file: `${HOOK}/bash.ts`,
    from: `  if (w.raw !== w.text || !w.text.includes(",")) return [w];`, to: `  return [w];` },
  { name: "qa-p3-colon-inline-off", clause: "P3 targets: -Path:value", file: `${HOOK}/bash.ts`,
    from: `      if (p.inline !== null) value = { text: p.inline, raw: p.inline, expands: w.expands };`, to: `      if (p.inline !== null && Date.now() < 0) value = { text: p.inline, raw: p.inline, expands: w.expands };` },
];
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8" });
for (const m of QA_MUTANTS) {
  const f = join(WT, m.file);
  const src = readFileSync(f, "utf8");
  if (src.split(m.from).length !== 2) throw new Error(`${m.name}: anchor not found exactly once`);
  writeFileSync(f, src.replace(m.from, m.to));
  writeFileSync(join(OUT, `${m.name}.diff`), git("diff", "--", m.file));
  git("checkout", "--", m.file);
  console.log(`wrote ${m.name}.diff`);
}
writeFileSync(join(OUT, "qa-specs.json"), JSON.stringify(QA_MUTANTS.map(({ name, clause }) => ({ name, clause })), null, 1));
