// QA 234 mutant runner. LOCAL only (T-207): nothing is pushed.
// For each mutant: apply it to a clean candidate tree (c1f1cb48) in <mutdir>, save its diff, run
// `tsc --noEmit` and `vitest run tests/planner-hook`, record the result, then restore src/.
// Developer mutants are applied from their committed .diff files; QA mutants are exact string edits.
// Usage: node qa234-mutants.mjs <mutdir> <diffdir> [only-id ...]
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [MUT, DIFFS, ...only] = process.argv.slice(2);
const OB = join(MUT, "open-brain");
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
mkdirSync(DIFFS, { recursive: true });

const DEV = ["ph1-tc", "ph2-tc", "ph3-tc", "d1-file", "d1-bash", "d2-compound", "grant-prefix", "repo-flag", "d066"];
const QA = [
  // r3-1 (D1): backslash paths are no longer converted, so the backslash absolute form is "outside".
  // Fail-closed would still deny it, so this one tests whether a test pins the PH-1 cause.
  { id: "qa-r31-backslash", file: "src/planner-hook/paths.ts",
    from: 'let p = raw.trim().replace(/\\\\/g, "/");', to: "let p = raw.trim();" },
  // r3-1: a path outside the repo is waved through as a relative path instead of denied.
  { id: "qa-r31-outside-ok", file: "src/planner-hook/paths.ts",
    from: "return { ok: false, cause: `${raw} is outside the repository",
    to: "return { ok: true, rel: abs }; return { ok: false, cause: `${raw} is outside the repository" },
  // r3-1: the drive/root comparison is case-sensitive again.
  { id: "qa-r31-case", file: "src/planner-hook/paths.ts",
    from: "const a = winRoot ? abs.toLowerCase() : abs;", to: "const a = abs;" },
  // r3-2 (D2): the compound detector forgets `|` and newlines.
  { id: "qa-r32-pipe-nl", file: "src/planner-hook/git.ts",
    from: "const COMPOUND_RE = /&|\\||;|[\\r\\n]|`|\\$\\(|[()]/;", to: "const COMPOUND_RE = /&|;|`|\\$\\(|[()]/;" },
  // r3-2: the "starts with gh pr merge" half is dropped (only the separator test remains).
  { id: "qa-r32-prefix", file: "src/planner-hook/run.ts",
    from: "if (!isSingleInvocation(command) || !/^gh\\s+pr\\s+merge\\b/.test(command.trim())) {",
    to: "if (!isSingleInvocation(command)) {" },
  // r3-3: the single-invocation test is applied to the grant text, not the command.
  { id: "qa-r33-grant-side", file: "src/planner-hook/grant.ts",
    from: "(c.startsWith(`${grant.command} `) && isSingleInvocation(c))",
    to: "(c.startsWith(`${grant.command} `) && isSingleInvocation(grant.command))" },
  // r3-4: -R is no longer recognised.
  { id: "qa-r34-no-R", file: "src/planner-hook/git.ts",
    from: "return /(?:^|\\s)(?:--repo\\b|-R)/.test(command);", to: "return /(?:^|\\s)(?:--repo\\b)/.test(command);" },
  // r3-4: --repo still denies, but only after origin's PR has been read (a fetch happens).
  { id: "qa-r34-fetch-first", file: "src/planner-hook/run.ts",
    from: "} else if (ghRepoFlag(command)) {",
    to: '} else if (ghRepoFlag(command) && (deps.prChangedPaths(ref ?? "0"), true)) {' },
];

const sh = (cmd, cwd = OB) => spawnSync(cmd, { cwd, env, shell: true, encoding: "utf8", maxBuffer: 64 << 20 });
const results = [];
const want = (id) => only.length === 0 || only.includes(id);

for (const m of [...DEV.map((id) => ({ id, dev: true })), ...QA]) {
  if (!want(m.id)) continue;
  execSync("git checkout -- open-brain/src", { cwd: MUT });
  const row = { id: m.id, origin: m.dev ? "developer" : "QA 234" };
  if (m.dev) {
    const a = sh(`git apply docs/loops/t194-r3/mutants/${m.id}.diff`, MUT);
    row.applied = a.status === 0 ? "clean" : `FAILED: ${a.stderr.trim()}`;
  } else {
    const f = join(OB, m.file);
    const src = readFileSync(f, "utf8");
    const n = src.split(m.from).length - 1;
    if (n !== 1) { row.applied = `FAILED: 'from' found ${n} times`; results.push(row); continue; }
    writeFileSync(f, src.replace(m.from, m.to));
    row.applied = "clean";
  }
  const diff = sh("git diff -- open-brain/src", MUT).stdout;
  writeFileSync(join(DIFFS, `${m.id}.diff`), diff);
  row.stat = sh("git diff --stat -- open-brain/src", MUT).stdout.trim().split("\n").pop();
  if (!row.applied.startsWith("clean")) { results.push(row); continue; }
  const tsc = sh("npx tsc --noEmit");
  row.tsc = tsc.status;
  row.tsc_out = (tsc.stdout + tsc.stderr).trim().split("\n").slice(0, 4).join(" | ");
  const vt = sh("npx vitest run tests/planner-hook");
  const text = (vt.stdout + vt.stderr).replace(/\x1b\[[0-9;]*m/g, "");
  row.vitest_exit = vt.status;
  row.tests = (text.match(/Tests\s+([^\n]+)/) ?? [])[1]?.trim() ?? "?";
  row.failed = [...text.matchAll(/(?:FAIL|×)\s+(tests\/planner-hook\/[^\n]+)/g)].map((x) => x[1].trim()).slice(0, 12);
  row.verdict = row.tsc !== 0 ? "invalid (tsc)" : vt.status !== 0 ? "red" : "SURVIVED";
  results.push(row);
  console.error(`${m.id}: ${row.verdict} (${row.tests})`);
}
execSync("git checkout -- open-brain/src", { cwd: MUT });
console.log(JSON.stringify(results, null, 1));
