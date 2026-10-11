# T-253 + T-248: state import keeps a bullet's continuation lines, reports every line it drops, and takes `--name`

**By:** Atlas (planner), session 167, 2026-10-11. **Tasks:** T-253 (P2), T-248 (P2). **Tag:** `T-253`.
**Seat:** forge (checkout `sia-forge`, QA PC). **Size:** SMALL-MEDIUM. **Written to**
`~/Worktrees/cursor-brief-checklist.md`. **The base SHA in the dispatch turn overrides §2's.**

## Why (planner, first-hand at `b142886f`)

Both tasks change one file, `open-brain/src/pipelines/state-import/index.ts`, plus the `state import` handler in
`open-brain/src/cli.ts`.

| # | Where (at `b142886f`) | What it does today |
|---|---|---|
| F1 | `bullets()`, `index.ts` lines 488–490 | Keeps only lines matching `/^\s*[-*] /`. Every other line in the section is dropped, including an indented continuation of the bullet above it. |
| F2 | `importHandoff()`, `index.ts` lines 513–518 | `report.watch_out` and `report.open_questions` are bullet counts. Nothing records a dropped line. |
| F3 | `renderImportReport()`, `index.ts` line 919 | Prints `watch_out: N bullets · open_questions: N bullets`, so a lost line cannot be seen in the report. |
| F4 | `buildImportDraft()`, `index.ts` lines 752–754 | `project.name` is `package.json`'s `name`, or the folder's name when there is none. There is no override. |
| F5 | `cli.ts` lines 584–593 | An unknown flag refuses. Every token that does not start with `-` is a positional. A naive `--name X` would make `X` a second positional, and the import would refuse with "more than one directory". |
| F6 | `runCommit()`, `index.ts` lines 1055 and 1106 | Parses the reviewed draft and writes `parsed.data` byte for byte. The draft's `project.name` reaches `state.json` unchanged, so **`--commit` needs no change for T-248.** |

**Evidence for T-253, read first-hand:** in the Makerspace snapshot
`Tarrant-County-Makerspace/.agents/archive/pre-state-migration-2026-10-09/SESSIONS/next-session.md`, lines 37–38 and
41–42 are watch-outs whose second line is indented by two spaces. Both second lines are missing from the draft.

**Corrections to the task text:**
1. Indented sub-bullets (`  - x`) are not dropped today. The regex allows leading whitespace, so they import as
   separate bullets. That stays as it is.
2. "`rename` became `Project: rename`" is the report's `Project:` line (`index.ts` line 885, `cli.ts` line 630). The
   record's `project.name` was `rename`, Makerspace's `package.json` name. The defect is that the name could not be
   overridden. There is no prefixing bug.
3. A joined continuation uses **one space**, never `\n`. `handoffCapViolations` (`shared/handoff-caps.ts` line 29)
   refuses a watch-out that spans more than one line.

```text
IMPACT-TARGETS: bullets importHandoff buildImportDraft runDraft renderImportReport ImportReport
```

(The `cli.ts` change is in the top-level `state` branch, which is not a named symbol. Its rows are NM-5, NM-6 and ST-8.)

**Out of scope, do not touch:**
- **T-184.** Do not add, change or move any detection of an input changing between `--draft` and `--commit`.
  `runCommit` is not edited at all.
- `detectStaleness`, `readInputs`, `findLastSession`, `importTasks`, `importDecisions`, `importObjective`,
  `sectionBody`, `planSummaryRemoval`, `takeSnapshot`, `rollBack`.
- `shared/state-schema.ts`, `shared/handoff-caps.ts`, `shared/state-writer.ts`.
- The `state show`, `state migrate` and `state erasures` branches of `cli.ts`.
- `CHANGELOG.md`, `package.json`, any doc, and any fixture under `open-brain/tests/fixtures-*`.

## 1. Shell and Node

PowerShell. Run these first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED T-253 node v24`.

## 2. Start state

**Base:** `origin/master` at **`b142886f875340913cc945399b1790167871fc08`**, unless the dispatch turn names another SHA.

```powershell
git fetch origin
git rev-parse origin/master
git switch -c fix/t253-t248-state-import <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. Otherwise STOP:
`BLOCKED T-253 start state`.

## 3. Forbidden git

Do not use any of these:
- `git stash`
- `reset --hard`
- `--force`
- rebase
- amend
- `cd` into another seat's tree

Touch no PR except your own.

## The work

### W1 (T-253). `index.ts`: continuation lines join their bullet, and every other line is reported

**a. New exported type, directly after `SupersededLink` (line 50):**

```ts
/** T-253: a non-blank line under `Watch out` or `Open questions` that is neither a bullet nor indented under one. */
export interface HandoffLineNotImported { line: number; section: "watch_out" | "open_questions"; text: string }
```

**b. `ImportReport.handoff` (line 83) gains one field, last:**

```ts
  handoff: { pick_up_lines: number; watch_out: number; open_questions: number; sections_not_imported: string[]; not_imported: HandoffLineNotImported[] };
```

In `buildImportDraft`, line 775 becomes
`handoff: { pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [], not_imported: [] },`.

**c. Replace `bullets` (lines 488–490) with exactly this:**

```ts
/**
 * T-253: a bullet's indented continuation lines join it with one space (a watch-out is one line: handoff-caps.ts).
 * Every other non-blank line in the section goes to `notImported`; none is dropped silently. A blank line does not
 * end a bullet. A reported line does, so an indented line after it is reported too.
 */
function bullets(body: string[], firstLine: number, section: HandoffLineNotImported["section"], notImported: HandoffLineNotImported[]): string[] {
  const out: string[] = [];
  let open = false;
  body.forEach((raw, k) => {
    if (/^\s*[-*] /.test(raw)) { out.push(raw.replace(/^\s*[-*] /, "").trim()); open = true; return; }
    if (raw.trim() === "") return;
    if (open && /^\s+\S/.test(raw)) { out[out.length - 1] = `${out[out.length - 1]} ${raw.trim()}`; return; }
    notImported.push({ line: firstLine + k, section, text: raw.trim().slice(0, 120) });
    open = false;
  });
  return out;
}
```

`firstLine` is the 1-based file line of `body[0]`. `sectionBody(lines, i)` starts at index `i + 1`, which is file line
`i + 2`.

**d. In `importHandoff`, lines 514 and 517 become:**

```ts
      handoff.watch_out = bullets(sectionBody(lines, i), i + 2, "watch_out", report.not_imported);
```
```ts
      handoff.open_questions = bullets(sectionBody(lines, i), i + 2, "open_questions", report.not_imported);
```

Lines 515 and 518 (the counts) are unchanged.

**e. In `renderImportReport`, directly after line 919 (the `pick_up: … bullets` line), insert:**

```ts
  L.push(`Lines NOT imported under Watch out / Open questions: ${r.handoff.not_imported.length}`);
  for (const n of r.handoff.not_imported) L.push(`- line ${n.line} (${n.section}): \`${n.text}\``);
```

The count line is always printed, so a report says `0` rather than going quiet.

**f. `cli.ts`, directly after line 650 (`Handoff: pick_up …`), insert:**

```ts
      if (rep.handoff.not_imported.length) console.log(`Handoff: ${rep.handoff.not_imported.length} line(s) under Watch out / Open questions NOT imported — listed in the report`);
```

### W2 (T-248). `--name <project name>` on the draft step

**a. `index.ts`, directly after line 858 (`ACCEPT_STALE_FLAG`):**

```ts
/** T-248: overrides the project name the draft takes from package.json or the folder. --draft only. */
export const NAME_FLAG = "--name";
```

**b. `ImportReport.project` (line 54):**

```ts
  project: { name: string; version: string; name_from: "package.json" | "folder" | "flag" };
```

Update the doc comment on line 53 to say: ``/** `name_from: "folder"` when there is no package.json name (R-BF-9); `"flag"` when --name gave it (T-248). */``

**c. `buildImportDraft` (line 743).** The signature becomes:

```ts
export function buildImportDraft(projectRoot: string, today: string, templateDir = defaultTemplateDir(), opts: { name?: string } = {}): ImportDraft {
```

Lines 752–754 become:

```ts
    project: opts.name !== undefined
      ? { name: opts.name, version: pkg?.version ?? "0.0.0", name_from: "flag" }
      : pkg?.name
        ? { name: pkg.name, version: pkg.version ?? "0.0.0", name_from: "package.json" }
        : { name: basename(root), version: pkg?.version ?? "0.0.0", name_from: "folder" },
```

**d. `runDraft` (line 986).** The signature becomes
`export function runDraft(projectRoot: string, today: string, opts: { name?: string } = {}): DraftResult {`.
Replace line 990 (`const draft = buildImportDraft(root, today);`) with:

```ts
  const name = opts.name?.trim();
  if (name === "") throw new Error(`${NAME_FLAG} is empty — nothing written`);
  const draft = buildImportDraft(root, today, defaultTemplateDir(), { name });
```

**e. `renderImportReport`, directly after line 884 (the `name_from === "folder"` line), insert:**

```ts
  if (r.project.name_from === "flag") L.push(`Project name: \`${r.project.name}\` was given with ${NAME_FLAG}. It replaces the package.json or folder name.`, "");
```

**f. `cli.ts`:**

1. Line 576: add `NAME_FLAG` to the destructured import from `./pipelines/state-import/index.js`.
2. Replace lines 584–585 (`importFlags` and `unknownFlags`) with:
   ```ts
   const importFlags = ["--draft", "--commit", "--force-snapshot", ACCEPT_STALE_FLAG, NAME_FLAG];
   // T-248: `--name <project name>` takes the next token as its value, so that token is neither a flag nor the directory.
   const rest = args.slice(2);
   if (rest.filter((a) => a === NAME_FLAG).length > 1) {
     console.error(`state import refused: ${NAME_FLAG} given more than once. Nothing written.`);
     process.exit(1);
   }
   const nameAt = rest.indexOf(NAME_FLAG);
   const nameValue = nameAt >= 0 ? rest[nameAt + 1] : undefined;
   if (nameAt >= 0 && (nameValue === undefined || nameValue.startsWith("-") || nameValue.trim() === "")) {
     console.error(`state import refused: ${NAME_FLAG} needs a project name after it, for example ${NAME_FLAG} "Tarrant County Makerspace". Nothing written.`);
     process.exit(1);
   }
   const plain = nameAt >= 0 ? [...rest.slice(0, nameAt), ...rest.slice(nameAt + 2)] : rest;
   const unknownFlags = plain.filter((a) => a.startsWith("-") && !importFlags.includes(a));
   ```
3. Line 593 becomes `const positionals = plain.filter((a) => !a.startsWith("-"));`.
4. Directly after the `ACCEPT_STALE_FLAG` refusal block (lines 607–610), insert:
   ```ts
   if (commit && nameAt >= 0) {
     console.error(`state import refused: ${NAME_FLAG} applies only to --draft; --commit writes the name the reviewed draft holds. Nothing written.`);
     process.exit(1);
   }
   ```
5. Line 626 becomes `const r = runDraft(projectRoot, today, { name: nameValue });`.
6. Line 630 becomes:
   ```ts
   console.log(`Project: ${rep.project.name}${rep.project.name_from === "folder" ? " — the folder's name: there is no package.json name, and none is needed" : rep.project.name_from === "flag" ? ` — given with ${NAME_FLAG}` : ""}`);
   ```
7. In the usage string on line 434, replace `import [--draft | --commit [--accept-stale]] [--force-snapshot]` with
   `import [--draft [--name <project name>] | --commit [--accept-stale]] [--force-snapshot]`.
8. Line 690 becomes:
   `console.log("  state import [--draft [--name <project name>]|--commit [--accept-stale]] [--force-snapshot]  Migrate .agents/ prose into state.json (once)");`

## 4. Commits (exactly two)

| # | Contents | Message |
|---|---|---|
| 1 | §6's two new test files, plus the one edit to `tests/pipelines/state-import.test.ts` given in §6. The new files must be red at this commit **on assertions** (they import nothing that is new). | `T-253/T-248: tests (red)` |
| 2 | W1 and W2 | `T-253 + T-248: state import joins continuation lines, reports dropped lines, takes --name` |

After each commit, paste `git status --porcelain` (it must be empty) and `git log --oneline <BASE_SHA>..HEAD` (1 line,
then 2). After commit 1, run §5's mutant command once and paste the summary. It must show failures in both new files.

## 5. Mutants (local only, never pushed; ALL run, none `NOT RUN`)

For each mutant:
1. `git switch -c mut-N <final head>`.
2. Make the one edit, then `git commit -am "MUTANT N"`.
3. Run the **mutant command** below, and paste the test that turned red with its assertion line.
4. `git switch fix/t253-t248-state-import`.

The tree must be clean after each one. Mutant branches are never pushed.

**Mutant command:** the same as §6's, with `$files` set to:
`tests/pipelines/state-import-t253.test.ts tests/pipelines/state-import-t248.test.ts`

| N | File: edit | Must turn red |
|---|---|---|
| 1 | `index.ts` `bullets`: delete the line `if (open && /^\s+\S/.test(raw)) { … return; }` | ST-1 |
| 2 | `index.ts` `bullets`: `` `${out[out.length - 1]} ${raw.trim()}` `` becomes `` `${out[out.length - 1]}\n${raw.trim()}` `` | ST-1 |
| 3 | `index.ts` `bullets`: delete the `notImported.push(...)` line | ST-3 |
| 4 | `index.ts` `bullets`: delete the `open = false;` line | ST-3 |
| 5 | `index.ts` `bullets`: `raw.trim().slice(0, 120)` becomes `raw.trim()` | ST-5 |
| 6 | `index.ts` `importHandoff`: in the `watch_out` call, `i + 2` becomes `i + 1` | ST-3 |
| 7 | `index.ts` `renderImportReport`: delete the `Lines NOT imported under …` `L.push` line | ST-6 |
| 8 | `cli.ts`: delete the `Handoff: … NOT imported — listed in the report` `console.log` line | ST-8 |
| 9 | `index.ts` `buildImportDraft`: `project: opts.name !== undefined` becomes `project: false` | NM-1 |
| 10 | `index.ts` `runDraft`: delete the `if (name === "") throw …` line | NM-3 |
| 11 | `index.ts` `renderImportReport`: delete the `name_from === "flag"` `L.push` line | NM-2 |
| 12 | `cli.ts`: `const plain = nameAt >= 0 ? … : rest;` becomes `const plain = rest;` | NM-5 |
| 13 | `cli.ts`: delete the `if (commit && nameAt >= 0) { … }` block | NM-6 |

## 6. Tests

### Shared setup for both new files

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnAsync } from "../spawn-async.js";
import { runDraft, runCommit, importHandoff, renderImportReport, DRAFT_REL, REPORT_REL, STATE_REL, type ImportReport } from "../../src/pipelines/state-import/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-14";
const NEXT = ".agents/SESSIONS/next-session.md";

async function cli(args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, env: process.env });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
```

- Use only the imports each file needs. **Do not import `NAME_FLAG`** (it does not exist at commit 1). Write the
  literal `"--name"`.
- `beforeEach`: `root = mkdtempSync(join(tmpdir(), "t253-"))` (`"t248-"` in file 2), then `cpSync(fixture, root, { recursive: true })`.
- `afterEach`: `rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })`.
- `const rep = (): ImportReport["handoff"] => ({ pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [], not_imported: [] });`
- Every multi-line input is an array joined with `"\n"` (ST-2 uses `"\r\n"`). Unit rows take the default timeout. A
  CLI row passes `60_000` as its `it` timeout, and NM-6 passes `120_000`.

### New file 1: `open-brain/tests/pipelines/state-import-t253.test.ts`

The `ST3` input, used by ST-3, ST-6 and ST-8:

```ts
const ST3 = ["# H", "", "## Watch out for", "Read these first:", "- one", "not indented, not a bullet", "  indented after a stray line", "", "## Open questions", "1. numbered", "- q"].join("\n");
```

| Row | Setup | Asserts |
|---|---|---|
| ST-1 | `r = rep()`; `h = importHandoff(["# H", "", "## Watch out for", "- first line", "- Browser tool: ref-clicks no-op after navigation, screenshot, then", "  coordinate-click. All tabs share the session.", "- third"].join("\n"), 55, r)` | `h.watch_out` equals `["first line", "Browser tool: ref-clicks no-op after navigation, screenshot, then coordinate-click. All tabs share the session.", "third"]`; `r.watch_out === 3`; `r.not_imported` equals `[]` |
| ST-2 | `r = rep()`; `h = importHandoff(["# H", "", "## Open questions", "- Tour booking: (a) or (b),", "\tAaron's call.", "- Budget"].join("\r\n"), 55, r)` | `h.open_questions` equals `["Tour booking: (a) or (b), Aaron's call.", "Budget"]`; `r.open_questions === 2`; `r.not_imported` equals `[]` |
| ST-3 | `r = rep()`; `h = importHandoff(ST3, 55, r)` | `h.watch_out` equals `["one"]`; `h.open_questions` equals `["q"]`; `r.not_imported` equals `[{ line: 4, section: "watch_out", text: "Read these first:" }, { line: 6, section: "watch_out", text: "not indented, not a bullet" }, { line: 7, section: "watch_out", text: "indented after a stray line" }, { line: 10, section: "open_questions", text: "1. numbered" }]` |
| ST-4 | `r = rep()`; `h = importHandoff(["## Watch out for", "- a", "", "  more of a", "- b"].join("\n"), 55, r)` | `h.watch_out` equals `["a more of a", "b"]`; `r.not_imported` equals `[]` |
| ST-5 | `r = rep()`; `h = importHandoff(["## Watch out for", "- a", "x".repeat(130)].join("\n"), 55, r)` | `h.watch_out` equals `["a"]`; `r.not_imported` equals `[{ line: 3, section: "watch_out", text: "x".repeat(120) }]` |
| ST-6 | `writeFileSync(join(root, NEXT), ST3)`; `runDraft(root, TODAY)`; `report = readFileSync(join(root, REPORT_REL), "utf8")` | `report` contains `"Lines NOT imported under Watch out / Open questions: 4"`, `"- line 6 (watch_out): \`not indented, not a bullet\`"` and `"- line 10 (open_questions): \`1. numbered\`"` |
| ST-7 | The fixture unchanged; `d = runDraft(root, TODAY)` | `d.draft.report.handoff.not_imported` equals `[]`; `d.draft.state.handoffs[0].watch_out` has length `9`; `renderImportReport(d.draft.report, "draft")` contains `"Lines NOT imported under Watch out / Open questions: 0"` |
| ST-8 (CLI, 60 s) | `writeFileSync(join(root, NEXT), ST3)`; `r = await cli(["state", "import", "--draft", root], root)` | `r.status === 0`; `r.stdout` contains `"Handoff: 4 line(s) under Watch out / Open questions NOT imported — listed in the report"` |

### New file 2: `open-brain/tests/pipelines/state-import-t248.test.ts`

`const NAME = "Tarrant County Makerspace";`

| Row | Setup | Asserts |
|---|---|---|
| NM-1 | `d = runDraft(root, TODAY, { name: NAME })` | `d.validation` equals `{ ok: true }`; `d.draft.state.project` equals `{ name: NAME }`; `d.draft.report.project` equals `{ name: NAME, version: "0.30.0", name_from: "flag" }`; `JSON.parse(readFileSync(join(root, DRAFT_REL), "utf8")).project` equals `{ name: NAME }`. Then, in the same row, a fresh root: `runDraft(root2, TODAY, { name: "  Spaced  " }).draft.state.project.name === "Spaced"` (make `root2` like `root`, and remove it at the end of the row) |
| NM-2 | `runDraft(root, TODAY, { name: NAME })`; `report = readFileSync(join(root, REPORT_REL), "utf8")` | `report` contains ``"Project name: `Tarrant County Makerspace` was given with --name. It replaces the package.json or folder name."`` |
| NM-3 | `d = runDraft(root, TODAY)` in this root. Then, in a fresh `root2`: `expect(() => runDraft(root2, TODAY, { name: "   " })).toThrow(/--name is empty — nothing written/)` | `d.draft.report.project` equals `{ name: "self-improving-agent", version: "0.30.0", name_from: "package.json" }`; `existsSync(join(root2, DRAFT_REL)) === false` |
| NM-4 | `runDraft(root, TODAY, { name: NAME })`, then `runCommit(root, TODAY, { version: "0.30.0" })` | `JSON.parse(readFileSync(join(root, STATE_REL), "utf8")).project` equals `{ name: NAME }` |
| NM-5 (CLI, 60 s) | `a = await cli(["state", "import", "--draft", "--name", NAME, root], root)`. Then delete `DRAFT_REL` and `REPORT_REL` from `root` and run `b = await cli(["state", "import", root, "--name", NAME], root)` | `a.status === 0`; `a.stdout` contains `"Project: Tarrant County Makerspace — given with --name"`; `JSON.parse(readFileSync(join(root, DRAFT_REL), "utf8")).project.name === NAME` (read after `b`); `b.status === 0` |
| NM-6 (CLI, 120 s) | Four runs, each in `root`: (a) `["state", "import", "--commit", "--name", NAME, root]`; (b) `["state", "import", "--draft", root, "--name"]`; (c) `["state", "import", "--draft", "--name", "--force-snapshot", root]`; (d) `["state", "import", "--draft", "--name", "A", "--name", "B", root]` | Each has `status === 1`. The `stderr` values match (a) `/--name applies only to --draft/`, (b) and (c) `/--name needs a project name after it/`, (d) `/--name given more than once/`. After all four, `existsSync(join(root, DRAFT_REL)) === false` and `existsSync(join(root, STATE_REL)) === false` |

### The one edit to an existing test (commit 1)

`open-brain/tests/pipelines/state-import.test.ts`, the row at lines 325–334
(`next-session rules: pick_up text, watch_out bullets…`):
- Line 326: the `rep` literal becomes
  `const rep: ImportReport["handoff"] = { pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [], not_imported: [] };`
- Line 332 becomes
  `expect(rep).toEqual({ pick_up_lines: 2, watch_out: 2, open_questions: 0, sections_not_imported: ["Refs"], not_imported: [] });`
  The input has no stray line under `### Watch out for`, so the list is empty.

Nothing else in that file changes. Line 333 (`importHandoff(null, …)`) returns the handoff, not the report, so it is
unaffected.

**Why this is the only edit to an existing test (planner's sweep at `b142886f`, every file under `open-brain/tests`
plus `open-brain/src`, `open-brain/scripts`, `scripts/`, `project-template/`):**
- **The report text.** No snapshot or golden of the import report exists. Every reader uses `toContain` or `toMatch`
  on other lines: `state-import.test.ts:147–151`, `state-import-seeds.test.ts:46`, `state-import-leftovers.test.ts:171–174`
  (a single line found by its prefix), `state-import-staleness.test.ts:76/128/145` (its first section only),
  `state-import-r6.test.ts:70/92/107`, and `bootstrap-fix-r3.test.ts:89/216`. The new line is additive.
- **The draft CLI's stdout.** Readers find one line by its prefix (`bootstrap-fix.test.ts:105` `Tasks:`,
  `state-import-staleness.test.ts:159` `Could not tell…`) or match with a regex. The new `Handoff: N line(s)…` line
  prints only when N > 0. `bootstrap-fix.test.ts:380` reads the `start` command's `Project:` line, not the import's.
- **Deep equality on `report.handoff`.** Only `state-import.test.ts:326/332`, edited above. Other `toEqual` calls on
  the report touch `inbox`, `staleness`, `last_session` or `summary_removal`, which are unchanged.
- **The watch_out arrays from an import.** `state-import.test.ts:139–140` (9 and 2) uses `fixtures-import`, whose
  Watch out and Open questions bullets are all single lines, so they are unchanged and ST-7 re-pins them. The
  `fixtures-import-a2a-hub` next-session (used only by `state-import-staleness.test.ts:18`) has single-line bullets
  and blank lines only. The inline inputs in `state-import-qa138.test.ts:66`, `state-import-r2.test.ts:64`,
  `state-import-r5.test.ts:27` and `state-import-staleness.test.ts:55` are one bullet each.
- **Non-test consumers.** `cli.ts:650` is the only reader of `report.handoff` in `src/`. `bootstrap/index.ts`,
  `end-record-guard.ts`, `cli-spec.ts` and `import-outputs.ts` only name `state import` in strings and comments.
  Nothing pins the usage strings at `cli.ts:434` and `cli.ts:690`.

### Command

PowerShell, from `open-brain/`. The run is a process whose PID you record. It gets a temp HOME, and the 10-minute cap
stops only that PID's tree (checklist 17):

```powershell
$iso = Join-Path $env:TEMP ("t253-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso; $env:KNOWLEDGE_V2_DB = Join-Path $iso "knowledge-v2.db"
$files = "tests/pipelines/state-import-t253.test.ts tests/pipelines/state-import-t248.test.ts tests/pipelines/state-import.test.ts tests/pipelines/state-import-atomic.test.ts tests/pipelines/state-import-ebusy.test.ts tests/pipelines/state-import-leftovers.test.ts tests/pipelines/state-import-qa122.test.ts tests/pipelines/state-import-qa138.test.ts tests/pipelines/state-import-r2.test.ts tests/pipelines/state-import-r3.test.ts tests/pipelines/state-import-r4.test.ts tests/pipelines/state-import-r5.test.ts tests/pipelines/state-import-r6.test.ts tests/pipelines/state-import-seeds.test.ts tests/pipelines/state-import-staleness.test.ts tests/pipelines/state-import-v3.test.ts tests/pipelines/bootstrap-fix.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
```

- Paste the vitest summary and the `EXIT=` line separately (G-042).
- Kill only with `taskkill /PID <the recorded PID> /T`. Never kill by name, image or command line. To see stray
  processes, LIST them and do not stop them.
- No test in this job spawns a waker or an agent. The CLI rows spawn `tsx` children of the vitest process, inside the
  recorded PID's tree. Afterwards, paste `Get-ChildItem $iso -Recurse -Name`.
- No watch mode, and never the whole suite.

## 7. Known red · 8. Typecheck · 9. Scope

**Known red.** No environment-only failure is known for these files on the QA PC. If a file you did not change fails:
1. `git switch --detach <BASE_SHA>`.
2. Run that one file with §6's command (`$files` set to that file).
3. `git switch fix/t253-t248-state-import`.
4. Paste both outputs.

If the failure is identical at the base, it was already there: name it and go on. You get at most **2** fix attempts
on your own failures. After that, STOP with `BLOCKED T-253 <test>`.

**Typecheck.** `npx tsc --noEmit` → `EXIT=0`. (It covers `src/` only.)

**Scope.** `git diff --name-only <BASE_SHA>..HEAD` may show only:

```
open-brain/src/pipelines/state-import/index.ts
open-brain/src/cli.ts
open-brain/tests/pipelines/state-import.test.ts
open-brain/tests/pipelines/state-import-t253.test.ts   (new)
open-brain/tests/pipelines/state-import-t248.test.ts   (new)
```

Anything else means STOP.

## 10. Push and PR

```powershell
git push origin fix/t253-t248-state-import
git ls-remote origin refs/heads/fix/t253-t248-state-import
git rev-parse HEAD
```

The two SHAs must be equal. If the push is rejected, STOP. Never use `--force`. Then:

```powershell
gh pr create --base master --head fix/t253-t248-state-import --title "T-253 + T-248: state import keeps continuation lines, reports dropped lines, takes --name" --body "Brief: docs/loops/t253-t248-state-import-brief.md. T-253 + T-248. Reviewed by the planner before QA."
```

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still posts a reply whose second line is `BLOCKED T-253 <reason>`.

## 12. Reply

The room is **the forge room the dispatch turn names**. Put its id in `$room` first.

```powershell
$room = "<the forge room id from the dispatch turn>"
$env:HUB_URL = "http://100.124.212.87:4000"
$ht = "C:/Users/Aaron Melven/Projects/A2A-Hub/scripts/hub-talk.mjs"
if (-not (Test-Path $ht)) { "hub-talk not at $ht: use the exact hub-talk.mjs path your --inbox call used at the start of this run" }
node $ht --as forge --session $room --say-file "$iso\reply.txt"; "EXIT=$LASTEXITCODE"
```

- Exit codes follow `.cursor/rules/hub-room.mdc`: 0 means posted, end the turn. 1 means the call was wrong: fix it, and do
  not retry it unchanged. 3 means the hub is unavailable: back off 5 s, doubling to 60 s, and stop after 5 in a row.
- Keep each post under 9,000 characters. Split it into two posts if needed, `(1/2)` and `(2/2)`.
- **Line 1:** `TASK: T-253 READY, state import continuation lines + --name (fix/t253-t248-state-import)`. On a stop,
  `BLOCKED` replaces `READY`.
- **Line 2:** `READY T-253 <sha40>` or `BLOCKED T-253 <reason>`.
- **Then, in order:**
  1. `node -v`
  2. The start state
  3. The commit log, and the red run after commit 1
  4. The test command, the vitest summary and the `EXIT=` line
  5. `git diff <BASE_SHA>..HEAD -- open-brain/src`
  6. The `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–13
  9. The push readback
  10. The PR number
  11. **IMPACT:** each target clark's launcher rated HIGH, CRITICAL or UNKNOWN, with the rows or §6 files that cover
      its callers, or `IMPACT: no HIGH/CRITICAL/UNKNOWN`.
- Every number is pasted command output, with the command shown above it. Anything not run is `NOT RUN`. End your turn
  after posting.

## 13. RAM and time

One test process, and no hub listener running alongside it. No real sleeps. No row depends on time: the CLI rows
wait on an awaited child process, not on a clock.

## Acceptance

| # | Check |
|---|---|
| T253-A1 | ST-1…ST-8 and NM-1…NM-6 pass. The existing files in §6 stay green. `tsc` gives 0. Scope is as §9. |
| T253-A2 | Mutants 1–13 are each red on their named rows. |
| T253-A3 | A Grok review (D-145 lane) of the diff returns APPROVE, or CHANGES that the planner rules on. |
| T253-A4 | Live, after merge and a rebuild: `open-brain state import --draft` on a scratch copy of the Makerspace snapshot's `.agents/` prose shows the two continuation lines inside watch_outs 2 and 5 and `Lines NOT imported under Watch out / Open questions: 0`. With `--name "Tarrant County Makerspace"`, the draft's `project.name` is that string. |
