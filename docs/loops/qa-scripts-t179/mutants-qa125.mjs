// QA 125's own mutants of the T-179 candidate (3c0bfdc). Each: one anchored substitution that must match EXACTLY once,
// a non-empty diff, `tsc --noEmit -p .`, then the named test files locally (vitest, per file, never the full suite).
// Commits each on its own branch qa/t179-mut-<name> from 3c0bfdc in the worktree given. Identity per command.
// usage: node mutants-qa125.mjs <worktree> [name...]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [WT, ...only] = process.argv.slice(2);
const OB = join(WT, "open-brain");
const W = "src/shared/state-writer.ts", SCH = "src/shared/state-schema.ts", ER = "src/pipelines/sync/record-erasure.ts", HG = "src/shared/handoff-guard.ts";
const MUTANTS = [
  { name: "ret-seat", why: "retention's (seat, checkout) key widened to seat only (the dispatch's first)", file: W,
    from: "o.seat === entry.seat && o.checkout === entry.checkout && o.session > entry.session",
    to: "o.seat === entry.seat && o.session > entry.session",
    tests: ["tests/shared/closeout-erasure.test.ts", "tests/pipelines/sync/record-erasure.test.ts", "tests/shared/state-writer.test.ts"] },
  { name: "render-seat", why: "the RENDER's newest-per-(seat, checkout) key widened to seat only (the greeting ruling)", file: SCH,
    from: "const key = `${h.seat}\\u0000${h.checkout ?? \"\"}`;",
    to: "const key = `${h.seat}`;",
    tests: ["tests/pipelines/session-start/state-render.test.ts", "tests/pipelines/state-views.test.ts", "tests/shared/state-schema.test.ts"] },
  { name: "uuid-skip-delete", why: "set_handoff replaces (deletes) the same seat-and-checkout entry WITHOUT the uuid check", file: W,
    from: "const idx = s.handoffs.findIndex((h) => h.session_uuid === ctx.uuid);",
    to: "const idx = s.handoffs.findIndex((h) => h.session_uuid === ctx.uuid || (h.seat === op.seat && h.checkout === ctx.checkout));",
    tests: ["tests/shared/closeout-erasure.test.ts", "tests/shared/state-writer.test.ts", "tests/pipelines/state-import-v3.test.ts"] },
  { name: "session-by-checkout", why: "sessions[] upsert finds 'mine' by checkout, not uuid, so it overwrites another session's record", file: W,
    from: "const mine = uuid === null ? undefined : next.sessions.find((s) => s.uuid === uuid);",
    to: "const mine = uuid === null ? undefined : next.sessions.find((s) => s.uuid === uuid || (s.checkout !== null && s.checkout === checkout));",
    tests: ["tests/shared/closeout-erasure.test.ts", "tests/shared/state-writer.test.ts", "tests/pipelines/state-import-v3.test.ts"] },
  { name: "erasure-blind-rev60", why: "the scan is blind to ONE revision: the step out of rev 60 (T-163's first known positive)", file: ER,
    from: "      const before = load(pbs[0]);\n",
    to: "      const before = load(pbs[0]);\n      if (revisionOf(before) === 60) continue;\n",
    tests: ["tests/pipelines/sync/record-erasure.test.ts"] },
  { name: "erasure-blind-merge", why: "the scan is blind to every MERGE step (G-027's resolution erasures)", file: ER,
    from: "for (const e of erasuresInMerge(parents, base, after)) {",
    to: "for (const e of ([] as ReturnType<typeof erasuresInMerge>)) {",
    tests: ["tests/pipelines/sync/record-erasure.test.ts"] },
  { name: "guard-repeat", why: "the next greeting's notice is not moved aside, so it repeats in every later session (T179-2: exactly once)", file: HG,
    from: "    unlinkSync(path);\n",
    to: "    void unlinkSync;\n",
    tests: ["tests/shared/handoff-guard.test.ts"] },
];
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8" }).trim();
const ID = ["-c", "user.name=QA 125 (Claude)", "-c", "user.email=melvenac@gmail.com"];
for (const m of MUTANTS.filter((x) => !only.length || only.includes(x.name))) {
  const br = `qa/t179-mut-${m.name}`;
  git("checkout", "-q", "--detach", "3c0bfdc");
  const p = join(OB, m.file);
  const src = readFileSync(p, "utf8");
  const n = src.split(m.from).length - 1;
  if (n !== 1) { console.log(`VOID ${m.name}: anchor matched ${n} times`); continue; }
  writeFileSync(p, src.replace(m.from, m.to));
  const diff = git("diff", "--stat");
  if (!diff) { console.log(`VOID ${m.name}: empty diff`); continue; }
  const tsc = spawnSync(process.execPath, [join(OB, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."], { cwd: OB, encoding: "utf8" });
  if (tsc.status !== 0) { console.log(`VOID ${m.name}: tsc exit ${tsc.status}\n${tsc.stdout.slice(0, 800)}`); git("checkout", "--", "."); continue; }
  const v = spawnSync(process.execPath, [join(OB, "node_modules/vitest/vitest.mjs"), "run", ...m.tests, "--reporter=dot"], { cwd: OB, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  const tail = (v.stdout + v.stderr).split("\n").filter((l) => /Tests |Test Files|FAIL|✗|×/.test(l)).slice(0, 14).join("\n   ");
  git(...ID, "switch", "-q", "-C", br);
  git(...ID, "commit", "-qam", `QA 125 mutant ${m.name}: ${m.why}\n\nNOT FOR MERGE. From 3c0bfdc (T-179 merge candidate).\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`);
  console.log(`\n${m.name} -> ${br} ${git("rev-parse", "--short", "HEAD")} | ${diff.split("\n").pop()} | tsc 0 | local (${m.tests.length} file(s)) vitest exit ${v.status}\n   ${tail}`);
}
git("checkout", "-q", "--detach", "3c0bfdc");
