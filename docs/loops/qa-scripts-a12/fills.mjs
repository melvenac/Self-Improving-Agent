// QA 149: replace each @@NAME@@ placeholder in report.md with its text; fail if any is missing or left over.
import { readFileSync, writeFileSync } from "node:fs";
const F = {
  CIUSED: "**8**",
  SUITE: "`SUITE_EXIT=0`, `Test Files 93 passed | 8 skipped (101)`, **`Tests 1351 passed | 77 skipped (1428)`**, 0 unhandled. The total equals CI's on the candidate (`36283457438`: 1 failed (CA-9) | 1422 | 5 (1428))",
  EFFORT: "EFFORTPLACE",
  VIAKILLS: "**R93-PARENT-LINK** and R91-VIA-FACTS (developer), Q130-R85-VIA-FILE000, Q130-R85-VIA-TARGET000",
  S6: `on tcm, real chmod (run 8, \`36293057531\`), Q149-S6-BASE-EACCES prints \`before: "c58c9189f417310c type file dev 66306 ino 5121125 nlink 1 size 20 …"\`, **\`after: "not read: loop base absent at loop base; current …/real-xdg/git/config type file dev 66306 ino 5121125 nlink 2 size 20 …"\`**, with the base note \`machine config xdg …/real-xdg/git/config unwatched: did not resolve: EACCES.\` The wrapped-\`realpath\` twin, Q149-S6-BASE-EACCES-MOCK, prints the same on tcm and on win32. The loop base was not absent. It could not be resolved, and the record says \`absent\`: the A10-3 class, on the base side`,
  C8NOTE: "Two of my mutants were not run on tcm, because the budget went to QA 130's three and the known negative. `q149-r90-code` is killed on win32 by Q149-MOCK-R90-TEXT. `q149-r92-factlabel` is killed on win32 by R92's known positive, which runs there.",
  MUTTABLE: [
    "| Mutant | Ruling | Edit at `7200e1c` | win32 kills (local) | tcm run | tcm kills |",
    "|---|---|---|---|---|---|",
    "| `q130-r85-factsdrop` (QA 130's, re-applied) | R93 (A10-4's shape) | the no-link `return factText(s)` becomes `return \"no facts: realpath failed\"` | 0 (its killing rows are POSIX) | `36292138310` | **R93-STAT-FACTS**, Q108-R79-FILE000-ALONE |",
    "| `q130-r88-lstat` (QA 130's, re-applied) | R93 (R88, an `lstat` failure at the open) | `if (!state?.readError \\|\\| state.dev === null) continue;` | 0 (POSIX) | `36292144008` | **R93-LSTAT-AT-OPEN**, Q130-R88-NOSEARCH-AT-OPEN, Q130-R83-227 |",
    "| `q130-r85b-via` (QA 130's, adapted) | R93 (R85b's parent-link branch) | R91's `if (s.viaLink !== null) { … }` block deleted | 0 (POSIX) | `36292149195` | **R93-PARENT-LINK**, R91-VIA-FACTS, Q130-R85-VIA-FILE000, -VIA-TARGET000 |",
    "| `q149-r90-typeword` | R90 bullet 1 | `; no facts: lstat failed` → `; type file; no facts: lstat failed` | Q149-MOCK-PRESENT-CONTROL; Q149-MOCK-R90-TEXT (probe 2) | `36292154203` | **R90-STATEHASH**, Q149-MOCK-PRESENT-CONTROL. Q130-R85-REPO-UNREADABLE-ZEROED **survives**: it checks only for zeroes |",
    "| `q149-r90-code` | R90 bullet 2 | `const code = a.readErrno ?? \"UNKNOWN\"` → `const code = \"UNKNOWN\"` | **Q149-MOCK-R90-TEXT** (probe 2). The 39-file batch: 0, because the rows that see the code are red on A12 at a later assertion | not run | — (by reading, the developer's R90-ABSENT-UNOBSERVABLE asserts `absent → unobservable (EACCES)`) |",
    "| `q149-r91-linkdrop` | R91 | `${ancestorLinkText(s)}; resolves to: …` → `resolves to: …` | 0 (POSIX) | `36292158435` | **R91-VIA-FACTS**, Q130-R85-VIA-FILE000 |",
    "| `q149-r92-factlabel` | R92 | the `absent →` branch prints `linkSide(end)` (for a non-link, the resolved file's facts) where `ancestorLinkText(end)` was | **Q130-R86-ABSENT-ANCESTOR-LINK**, Q108-R79-ANCESTOR-ZEROED | not run | — |",
    "| `FIX-q149` (known negative) | A12-1 | the R90 branch also does `unrestored.push(\\`${path} (absent at the open; cannot be lstat'd at close (${code}); not removed)\\`)` | **0 kills**; heals Q149-MOCK-HOOKS-ONLY and -PLUS-CONFIG; probe 2 unchanged | `36292163102` | **0 kills**; heals 5: Q130-R83-SUBDIR-NOSEARCH-PLANT, Q149-C1-HOOKS-ONLY, -SUBDIR-ONLY, Q149-MOCK-HOOKS-ONLY, -PLUS-CONFIG. 15 failed = CA-9 and the 14 carried reds |",
    "",
    "- **The win32 batch** (`runmut12.sh`, 39 files, 425 tests: 267 passed, 9 failed and 149 skipped at BASELINE) ran",
    "  03:40–04:00Z, one tree at a time, with nothing beside it. Probe 2 (`runp2.sh`) ran after it, on BASELINE,",
    "  `q149-r90-code`, `-typeword` and `FIX-q149`. On BASELINE: 1 failed (S6-MOCK, O-1), 1 passed (R90-TEXT), 1 skipped.",
    "- **Every ruling R90–R92 has at least one of my mutants killed.** R93's three are QA 130's own, each killed by the developer's adopted row.",
  ].join("\n"),
  SUITEDETAIL: [
    "**04:00:53Z → 04:04:29Z, `SUITE_EXIT=0`, captured unpiped (`suite12.sh`).**",
    "- **Where:** `C:/qa-scratch/qa149/wt-a12/open-brain`, a detached worktree at `a69f07d`, after `npm ci`, `tsc --noEmit`",
    "  and `npm run build` (each exit 0). 0 porcelain entries before and after, and HEAD is `a69f07d` after.",
    "- **The Defender-on control (T-190):** `TEMP`=`TMP`=`C:\\Users\\AARONM~1\\AppData\\Local\\Temp` (the driver's",
    "  `QA_DEFAULT_TEMP`).",
    "- **Result:** `Test Files 93 passed | 8 skipped (101)`, **`Tests 1351 passed | 77 skipped (1428)`**, duration 213.41 s,",
    "  0 matches for `Unhandled|onTaskUpdate`. **The total, 1428, equals CI's on the candidate** (`36283457438`).",
    "- **The 77 skips** are win32 skips of POSIX-only rows and the real-`claude` rows. That is QA 130's 70, plus A12's 7",
    "  `configwatch-a12` rows, which are all `skipIf(isWin)`.",
    "- **Processes** (`tasklist /V`, CSV, before and after): 215 and 212. Of claude, node, git and Cursor, only this",
    "  session's `claude.exe` (PID 884) was present, before and after. The mutant batch had ended at 04:00:06, and the",
    "  probe-2 runs before the build.",
    "- **Defender** (`MsMpEng.exe`, PID 3352) went from 9:05:10 to 9:09:39 of CPU: **4 min 29 s during the 3 min 36 s",
    "  suite**. So it was scanning, as the control intends.",
  ].join("\n"),
  CITABLE: [
    "| # | Branch (`qa/loop-15-slice-3-a12-…`) | Head | Run | Runner | Tests (failed \\| passed \\| skipped) | What it shows |",
    "|---|---|---|---|---|---|---|",
    "| 1 | `probe` | `c35fb40` = `7200e1c` + QA 130's 15 probe files byte-exact + `qa149-a12-probe`, `-mock` | **`36292117395`** | tcm-2 | 20 \\| 1568 \\| 5 (1593) | the base. Against QA 130's `36279688475`: 3 healed (R90–R92's positives), **Q130-R83-SUBDIR-NOSEARCH-PLANT red**, my 4 check-1 rows red, CA-9 and the 14 carried reds |",
    "| 2 | `m-r85-factsdrop` | `76242f8` | `36292138310` | tcm-2 | 22 \\| 1566 \\| 5 | 2 kills |",
    "| 3 | `m-r88-lstat` | `066e20d` | `36292144008` | tcm-1 | 23 \\| 1565 \\| 5 | 3 kills |",
    "| 4 | `m-r85b-via` | `25db284` | `36292149195` | tcm-1 | 24 \\| 1564 \\| 5 | 4 kills |",
    "| 5 | `m-r90-typeword` | `1526950` | `36292154203` | tcm-2 | 22 \\| 1566 \\| 5 | 2 kills |",
    "| 6 | `m-r91-linkdrop` | `33ad1e0` | `36292158435` | tcm-2 | 22 \\| 1566 \\| 5 | 2 kills |",
    "| 7 | `fix-q149` | `7a24bad` | `36292163102` | tcm-1 | 15 \\| 1573 \\| 5 | known negative: 5 healed, **0 kills** |",
    "| 8 | `probe2` | `b462496` = 1 + `qa149-a12-probe2` | `36293057531` | tcm-1 | 22 \\| 1569 \\| 5 (1596) | O-1 on Linux (real chmod and wrapped); Q149-MOCK-R90-TEXT `✓` |",
    "",
    "**Budget: 8 of 8 used.** Each mutant or FIX branch differs from run 1 in its one source file (`git diff --stat c35fb40`:",
    "one file each), and run 8 differs in its one test file. Every run fails CA-9 (T-182), as the dispatch says.",
  ].join("\n"),
  NOTVERIFIED: [
    "- **`q149-r90-code` and `q149-r92-factlabel` on tcm.** There was no run left for them. Both are killed on win32 (§3).",
    "- **The carried reds' messages on tcm.** They are compared by name only, against QA 130's run. On win32 the first",
    "  lines are compared, and they are byte-identical.",
  ].join("\n"),
  O1: "tcm `36293057531` (real chmod and wrapped) and win32 (wrapped): Q149-S6-BASE-EACCES, -MOCK. The base note records the truth (`unwatched: did not resolve: EACCES`)",
  O1SHORT: "Q149-S6-BASE-EACCES (Linux) and -MOCK (every platform), in `qa149-a12-probe2.test.ts`",
  P2NOTE: "It also went to tcm in run 8 (`✓`). The 39-file batch and runs 1–7 do not carry probe 2; §3 names which result comes from which.",
  OPENMORE: "5. **All 8 CI runs are used.** `q149-r90-code` and `q149-r92-factlabel` are killed on win32 only (§3).",
  BRANCHTABLE: [
    "| Branch (pushed with `push-qa.mjs`, read back) | Head | What |",
    "|---|---|---|",
    "| `qa/loop-15-slice-3-a12-probe` | `c35fb40` | A12 `7200e1c` + QA 130's 15 probe files (byte-exact from `5564ef6`) + `qa149-a12-probe.test.ts`, `qa149-a12-mock.test.ts` |",
    "| `qa/loop-15-slice-3-a12-probe2` | `b462496` | + `qa149-a12-probe2.test.ts` |",
    "| `qa/loop-15-slice-3-a12-m-r85-factsdrop`, `-m-r88-lstat`, `-m-r85b-via` | `76242f8`, `066e20d`, `25db284` | QA 130's three R93 mutants, re-applied |",
    "| `qa/loop-15-slice-3-a12-m-r90-typeword`, `-m-r91-linkdrop` | `1526950`, `33ad1e0` | + my mutants |",
    "| `qa/loop-15-slice-3-a12-fix-q149` | `7a24bad` | + FIX-q149 (A12-1's known negative) |",
    "| `qa/loop-15-slice-3-a12-report` | this commit | this report and `docs/loops/qa-scripts-a12/` |",
    "",
    "Local only (not pushed; no CI run): `qa/loop-15-slice-3-a12-m-r92-factlabel` `a8824af` and `-m-r90-code` `9c7c47b`.",
  ].join("\n"),
};
let s = readFileSync("C:/qa-scratch/qa149/report.md", "utf8");
for (const [k, v] of Object.entries(F)) {
  const tag = `@@${k}@@`;
  if (!s.includes(tag)) { console.error(`missing ${tag}`); process.exit(2); }
  s = s.split(tag).join(v);
}
const left = s.match(/@@[A-Z0-9]+@@/g);
if (left) { console.error(`left: ${left.join(",")}`); process.exit(3); }
writeFileSync("C:/qa-scratch/qa149/report.md", s);
console.log("filled", Object.keys(F).length);
