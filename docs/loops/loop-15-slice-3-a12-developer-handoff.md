# Loop 15 slice three — A12 developer handoff

**By:** Grok 4.7 (developer), record session 143. **Planner:** Atlas, hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`.
**Candidate:** `loop/15-slice-3-candidate-a12` at `7200e1c`. Base: A11 `bbf9d07` merged with `origin/master` `ebda33d` (merge `afe1c3b`).
**Model:** Grok 4.7. This Cursor session did not surface an effort setting.
No `/end`. No laptop CI. No full local suite. `tsc --noEmit` before every push. This worktree has no GitNexus index, so impact was not run; the edit is the text sites below.

## R94 merge resolution

Named **both edits**. The only conflict was `.github/workflows/ci.yml`.

- The `test` job keeps A9's `npm test -- --reporter=verbose`.
- Master's `test-windows` job is kept whole: the `windows` / `step0` / `workers` / `cpu` / `disk` / `spawn` inputs, and the laptop job that runs only on `workflow_dispatch` with `windows=true`.

## What changed (`7200e1c`)

`open-brain/src/harness/configwatch.ts` only.

- **R90, stateHash.** A `readError` whose `dev` is null prints `unreadable (<code>); no facts: lstat failed`. No `type file`, no zeroes. A read failure that still has an lstat keeps `type file` and those facts.
- **R90, classification.** A path absent at the open whose `lstat` fails at the close is not `kind: "created"`. The stored kind is `"modified"` and the message omits the kind word, so the record reads `absent → unobservable (<code>); unreadable (<code>); no facts: lstat failed`. Nothing is removed, and the unrestored note does not say `a other was created`. A path that can be `lstat`ed is still `created` / `deleted` / `modified` as before.
- **R91.** `unobservableSide` under a parent link prints that link's `lstat`, and `resolves to:` plus the file's `stat` when `observe` has one (`dev` set).
- **R92.** The `absent →` branch, when the path itself is not the symlink, prints `ancestorLinkText` (the link's `lstat`) before `currentSide`.
- **A11-4.** The unlstatable `a other was created` note is the R90 path and is not emitted. A directory at `.git/config` still becomes `stateHash(null)` → `absent`. That half stays with A10-8's family; it is not one line.

`qa/loop-15-slice-3-a11-fix-q130` was read and not copied. It changes the three texts and does not change the `created` classification. R90's second bullet is the part it does not cover.

## R85 search, redone on `7200e1c`

Every site that builds a side's text, and what it prints for a failed `lstat`, a failed `stat` (read refused, `lstat` succeeded), a link, and an absent path.

| Site | Failed `lstat` | Failed `stat` | Link | Absent |
|---|---|---|---|---|
| `stateHash` :517 | `unreadable (<code>); no facts: lstat failed` | `unreadable (<code>); type file dev … ino … nlink … size … mtimeNs …` | `type:symlink readlink:<target>` | `absent` (the argument is null: a real absence, and also a directory or other non-file `readState` turns into null — A11-4) |
| close record :824 | `absent → unobservable (<code>); ` plus the `stateHash` above. Kind stored `"modified"`. Message omits the kind word. No removal, no `a other was created` | not this branch (`dev` is set) | not this branch | the before word of that record |
| message :894 | kind word omitted when `after` starts with `unobservable (` | `<rel> <kind> (<before> → <after>)` | same | same |
| unrestored :850 | not reached for this failure | a real created non-file still says `a <kind> was created` | a symlink is removed | not this note |
| `factText` :1301 | not used for a snap with no facts | `type <kind> dev … ino …` of the `lstat` | the snap's own fields, not the link label | not the word absent |
| `readText` :1304 | not a read | not a read | `<hash> ` + `factText` when the read succeeded | not a read |
| `linkSide` :1305 | a link that does not resolve: `link: type symlink dev … ino … readlink …; does not resolve (<code>)` | `resolves to:` + `factText` when the target was read | that label | `does not resolve` when `resolvedPath` is null |
| `ancestorLinkText` :1316 | the parent link's own `lstat` (`viaDev` … `viaTarget`), which succeeded | same, plus the caller may append the file | `link: type symlink dev ${viaDev} … readlink ${viaTarget}` | the link facts, not the word absent |
| `unobservableSide` :1319 | no parent link: `no facts: realpath failed`. Parent link and `dev` null: `ancestorLinkText` only. A link at the path: `linkSide` | parent link and `dev` set: `ancestorLinkText` + `; resolves to: ` + `factText`. No parent link: `factText` | `linkSide` | not this function; the caller prefixes `unobservable (<errno>)` |
| `currentSide` :1329 | non-link, unresolved: `s.reason` (`did not resolve: <code>`), no zeroes | resolved path + `factText` | `linkSide` | `s.reason` when that reason is `absent (ENOENT)` |
| `baseText` :1335 | — | path + `factText` when it resolved | unresolved symlink: `unresolved ` + `factText` | `absent at loop base` when `resolvedPath` is null and the path is not a symlink |
| `stageBefore` :1337 | `opened.reason` (`did not resolve: <code>`) when `resolvedPath` is null and it is not the unreadable/symlink cases above it | `unreadable; stage start ` + `factText` | unresolved symlink: reason + `factText` | the reason string when the path did not resolve |
| unobservable row :1356 | `unobservable (<errno>); ` + `unobservableSide` | same | same | the before side is `stageBefore` |
| `absent →` :1389 | ancestor link: `ancestorLinkText` then `currentSide`. Link at the path: `currentSide` / `linkSide` | file facts come from `currentSide` when the target resolved | `link: type symlink` from `ancestorLinkText` or `linkSide` | the words `absent → symlink` |
| type-change :1390 | same split as A11: ancestor link text when the path is not itself the symlink | `currentSide` / `factText` of the resolved file | `link: type symlink` | `baseText` says `absent at loop base` when the loop base did not resolve |
| stable label :1371 | an unresolved non-link prints the label only (a parent link's `lstat` is not added). By reading; `changed` is false | `unreadable; stage start ` + `factText` | fact text or the symlink label | the label, not a created file |

`observe` fills the snap. It does not build the printed side; the rows above do.

## Red, then green, on tcm

Runner: `workflow_dispatch` of `ci.yml`, `hosted` and `windows` left false, so the `test` job is the self-hosted tcm runner. Read per test from the verbose log.

**Red** `974eade`, run `36283323236` (5 failed, 1418 passed, 5 skipped):

| Row | Result | Received |
|---|---|---|
| R90-STATEHASH | fail | `unreadable (EACCES); type file dev null ino null nlink 0 size 0 mtimeNs 0` |
| R90-ABSENT-UNOBSERVABLE | fail | `kind` is `created` |
| R91-VIA-FACTS | fail | link `lstat` only; the file ino is absent |
| R92-ABSENT-ANCESTOR | fail | `absent → symlink target …; not read through; <path> type file …` with no `link: type symlink` |
| R93-STAT-FACTS, R93-LSTAT-AT-OPEN, R93-PARENT-LINK | pass | the behaviour was already on A11 |

**Green** `7200e1c`, run `36283457438`: all seven A12 rows pass. Suite: 1 failed, 1422 passed, 5 skipped (1428).

**CA-9** (`--permission-prompts` missing from tcm's `claude --help`) fails on both runs. It is T-182, not this candidate. QA 130 already recorded it.

## Mutants

Each branch is `7200e1c` plus one deletion. `tsc` before the push. tcm run, same dispatch. Each also fails CA-9; the extra failure is the row.

| Branch | SHA | Run | Kills |
|---|---|---|---|
| `loop/15-slice-3-a12-mut-r90-hash` | `c9a1cd7` | `36283683383` | R90-STATEHASH (2 failed: that row and CA-9) |
| `loop/15-slice-3-a12-mut-r90-created` | `1486dc5` | `36283685105` | R90-ABSENT-UNOBSERVABLE |
| `loop/15-slice-3-a12-mut-r91` | `a3e268c` | `36283686948` | R91-VIA-FACTS |
| `loop/15-slice-3-a12-mut-r92` | `3410972` | `36283688998` | R92-ABSENT-ANCESTOR |
| `loop/15-slice-3-a12-mut-r93-factsdrop` | `7d7c290` | `36283690952` | R93-STAT-FACTS (QA's `q130-r85-factsdrop`: the no-link `factText` return becomes `no facts: realpath failed`) |
| `loop/15-slice-3-a12-mut-r93-lstat` | `3e3e420` | `36283693006` | R93-LSTAT-AT-OPEN (QA's `q130-r88-lstat`) |
| `loop/15-slice-3-a12-mut-r93-via` | `6546937` | `36283694906` | R93-PARENT-LINK and also R91-VIA-FACTS (3 failed, including CA-9). QA's `q130-r85b-via` drops the parent-link branch, so both rows that require the link's `lstat` go red |

## Not verified

- No Windows / laptop run (not dispatched).
- No full local suite.
- QA 130's probe file is not on this branch. The adopted rows are the developer's, in `open-brain/tests/harness/configwatch-a12.test.ts`.
- A11-4's directory → `absent` is unchanged.
