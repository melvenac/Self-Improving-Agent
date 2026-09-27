// QA 138, O7: the half-restored refusal with 1, 2 and 3 markers, created in NON-date order; candidate vs base, byte-compared.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
const [cand, base, scratch] = process.argv.slice(2).map((p) => resolve(p));
rmSync(scratch, { recursive: true, force: true });
const sets = { one: ["2026-05-05"], two: ["2026-09-09", "2026-01-01"], three: ["2026-06-06", "2026-01-01", "2026-03-03"] };
for (const [name, dates] of Object.entries(sets)) {
  const out = {};
  for (const [label, wt] of [["cand", cand], ["base", base]]) {
    const root = join(scratch, `${name}-${label}`);
    mkdirSync(join(root, ".agents/TASKS"), { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, ".agents/TASKS/INBOX.md"), "# Inbox\n");
    for (const d of dates) { mkdirSync(join(root, `.agents/archive/pre-state-migration-${d}`), { recursive: true }); writeFileSync(join(root, `.agents/archive/pre-state-migration-${d}.import-incomplete`), "x"); }
    const r = spawnSync(process.execPath, [join(wt, "open-brain/build/cli.js"), "state", "import", "--commit", root], { encoding: "utf8" });
    const r2 = spawnSync(process.execPath, [join(wt, "open-brain/build/cli.js"), "state", "import", "--draft", root], { encoding: "utf8" });
    out[label] = { commit: `exit ${r.status}: ${r.stderr.trim()}`, draft: `exit ${r2.status}: ${r2.stderr.trim()}` };
  }
  console.log(`==== ${name} marker(s), created in the order ${dates.join(", ")}`);
  console.log(`  cand --commit ${out.cand.commit}`);
  console.log(`  cand --draft  ${out.cand.draft === out.cand.commit ? "(same text as --commit)" : out.cand.draft}`);
  console.log(`  base --commit ${out.base.commit}`);
  console.log(`  cand and base byte-identical: ${out.cand.commit === out.base.commit}`);
}
