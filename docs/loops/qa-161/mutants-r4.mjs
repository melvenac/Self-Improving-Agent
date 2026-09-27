// QA 161 mutants for /bootstrap r4. Usage: node mutants-r4.mjs <SIA checkout> <mutant-id>
// mutant-id: bf17 | bf18 | bf19 | bf20 | bf21 | restore
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SIA = resolve(process.argv[2]);
const id = process.argv[3];
const OB = join(SIA, "open-brain");
const files = {
  record: join(OB, "src/shared/state-record.ts"),
  root: join(OB, "src/shared/repo-root.ts"),
  bootstrap: join(OB, "src/pipelines/bootstrap/index.ts"),
  cli: join(OB, "src/cli.ts"),
};
const backups = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, `${p}.qa161bak`]));

function backup() {
  for (const [k, p] of Object.entries(files)) {
    if (!existsSync(backups[k])) writeFileSync(backups[k], readFileSync(p, "utf8"));
  }
}
function restore() {
  for (const [k, p] of Object.entries(files)) {
    if (existsSync(backups[k])) writeFileSync(p, readFileSync(backups[k], "utf8"));
  }
}
function patch(file, from, to) {
  const p = files[file];
  const t = readFileSync(p, "utf8");
  if (!t.includes(from)) throw new Error(`anchor missing in ${file}: ${from.slice(0, 60)}`);
  writeFileSync(p, t.replace(from, to));
}

if (id === "restore") { restore(); console.log("restored"); process.exit(0); }

backup();
restore();
backup();

switch (id) {
  case "bf17":
    patch("record", 'if (!Object.hasOwn(data, "schema_version")) return "a JSON object with no schema_version";', 'if (!Object.hasOwn(data, "schema_version")) return null; // mutant');
    break;
  case "bf18":
    patch("root", "|| isStateRecord(join(dir, \".agents\", \"state.json\"))) return true;",
      "|| existsSync(join(dir, \".agents\", \"state.json\"))) return true; // mutant");
    break;
  case "bf19":
    patch("bootstrap",
      "return `STOP: this folder is inside another repository (${g.toplevel}). \\`git init\\` here makes this folder its own project, or move the folder out of the enclosing repository.`;",
      "return `STOP: this folder is inside another repository (${g.toplevel}). Move the folder out of the enclosing repository.`; // mutant");
    break;
  case "bf20":
    patch("bootstrap", 'return `bootstrap move-residue — not undone: ${err.message}`;',
      'return `bootstrap move-residue refused: ${err.message}`; // mutant');
    break;
  case "bf21":
    patch("cli", 'const { inspectProject, moveResidue, scaffold, formatMoveResidueFailure } = await import("./pipelines/bootstrap/index.js");',
      'const hook = process.env.OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK; if (hook) await import(hook); const { inspectProject, moveResidue, scaffold, formatMoveResidueFailure } = await import("./pipelines/bootstrap/index.js"); // mutant');
    break;
  default:
    console.error(`unknown mutant ${id}`);
    process.exit(2);
}

const tsc = spawnSync("npm", ["run", "build"], { cwd: OB, encoding: "utf8", shell: true });
if (tsc.status !== 0) { console.error(tsc.stdout + tsc.stderr); process.exit(1); }
const vitest = spawnSync("npx", ["vitest", "run", "tests/pipelines/bootstrap-fix-r4.test.ts"], { cwd: OB, encoding: "utf8", shell: true });
console.log(vitest.stdout + vitest.stderr);
process.exit(vitest.status === 0 ? 1 : 0);
