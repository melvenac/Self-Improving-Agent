# T-168: the heavy-suite runner works out its seat from the checkout, or refuses naming --seat (D-156, option R)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t168r-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-168 (P1), ruled by D-156. **Tag:** `T-168R`. **Size:** SMALL.
**Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: resolveCheckoutSeat (open-brain/src/pipelines/session-start/seat-map.ts, read only, unchanged); the change is in open-brain/src/cli-suite-run.ts main (a script entry, not a symbol) plus a new open-brain/src/suite-seat.ts; covered by tests/t168-owner-wired.test.ts, tests/suite-run-meta.test.ts
```

## Why

`open-brain/src/cli-suite-run.ts:210` reads `const seat = arg("--seat") ?? process.env.SUITE_SEAT ?? "cursor-builder";`.
The seat names the machine lease's holder and picks the hub key that reads the peer census. The QA PC's CC-half run
(s171) found that an un-flagged run from a one-off clone, or from the planner checkout, takes the lease and reads the
census as the builder. Aaron ruled R (D-156): **work out the seat from the checkout, and refuse to run when it can't,
naming the --seat flag. No default.**

The checkout → seat map already exists: `resolveCheckoutSeat(projectRoot)` in
`src/pipelines/session-start/seat-map.ts` (T-203) reads `.agents/SYSTEM/hub-partner-seats.json` by the checkout's
basename. The lease and census want the seat's **hub name** (`atlas`, `cursor-builder`, `forge`, `cursor-infra`),
which is the row's `hub_name`. The `qa` and `research` rows have none.

## Ruling (exact)

### 1. New module `open-brain/src/suite-seat.ts`

```ts
export type SuiteSeat =
  | { ok: true; seat: string; source: "--seat" | "SUITE_SEAT" | `checkout ${string}` }
  | { ok: false; why: string };
export function resolveSuiteSeat(input: { flag: string | undefined; env: string | undefined; cwd: string }): SuiteSeat
```
In this order:
1. `flag` non-empty after trim → `{ ok: true, seat: flag.trim(), source: "--seat" }`.
2. `env` non-empty after trim → `{ ok: true, seat: env.trim(), source: "SUITE_SEAT" }`.
3. Walk up from `resolve(cwd)` to the first directory that contains `.agents/SYSTEM/hub-partner-seats.json`
   (`SEAT_MAP_REL` from seat-map.ts). If none is found up to the filesystem root, return
   `{ ok: false, why: "no .agents/SYSTEM/hub-partner-seats.json at or above <cwd>" }`.
4. `r = resolveCheckoutSeat(thatDir)`, then:
   - `seat` with a non-null `hubName` → `{ ok: true, seat: r.hubName, source: \`checkout ${r.checkout}\` }`;
   - `seat` with `hubName === null` → `why: "seat <r.seat> (checkout <r.checkout>) has no hub_name in .agents/SYSTEM/hub-partner-seats.json"`;
   - `seatless` → `why: "checkout <r.checkout> is seatless: <r.reason>"`;
   - `unknown` → `why: "checkout <r.checkout> is not in .agents/SYSTEM/hub-partner-seats.json"`;
   - `no-map` or `unreadable` → `why:` its reason (`no-map`: the step 3 text).

It imports only node builtins and `./pipelines/session-start/seat-map.js` (both are core, so the module-boundary
check holds).

### 2. `open-brain/src/cli-suite-run.ts` `main()`

Replace the line `const seat = arg("--seat") ?? process.env.SUITE_SEAT ?? "cursor-builder";` with:
```ts
  // T-168 / D-156: no default seat. The seat comes from --seat, SUITE_SEAT or this checkout's row in the seat map.
  const resolved = resolveSuiteSeat({ flag: arg("--seat"), env: process.env.SUITE_SEAT, cwd: process.cwd() });
  if (!resolved.ok) {
    process.stderr.write(`suite refused: no seat for this run: ${resolved.why}. Pass --seat <hub name> (or set SUITE_SEAT).\n`);
    process.exitCode = 2;
    return;
  }
  const seat = resolved.seat;
  process.stdout.write(`suite seat: ${seat} (${resolved.source})\n`);
```
This runs before the owner, lease, census and meta, so a refused run takes no lease and writes no meta file. Nothing
else in `main()` changes. Update the header comment's refusal list with the words "or when no seat can be worked out
(D-156)".

### 3. Nothing else in src changes.

## Rows (commit 1: new file `open-brain/tests/t168-seat-resolve.test.ts`)

Spawn the runner as `tests/t168-owner-wired.test.ts` does (`process.execPath, [TSX, CLI, ...]`), and copy its
`baseEnv()` and `fixtures()` helpers. Every spawn uses `--owner-pid 100 --meta <dir>/meta.json` and this env:
`{ ...baseEnv(), SUITE_CENSUS_FIXTURE: census, SUITE_DRY_RUN: "1", SUITE_LEASE_EXIT: "0", SUITE_LEASE_STATUS_EXIT: "0", SUITE_LEASE_RELEASE_EXIT: "0" }`,
plus each row's own flag or env.

**The fixture map:** write `<root>/<checkout>/.agents/SYSTEM/hub-partner-seats.json` holding
```json
{ "seats": {
    "planner": { "checkout": "sia-planner", "role": "planner", "agent": "Atlas", "hub_name": "atlas", "runtime": "claude-code", "host": "desktop", "model": "m" },
    "builder": { "checkout": "sia-builder", "role": "developer", "agent": "Builder", "hub_name": "cursor-builder", "runtime": "cursor", "host": "qa-pc", "model": "m" },
    "qa":      { "checkout": "sia-qa", "role": "qa", "agent": "Probe", "runtime": "claude-code", "host": "qa-pc", "model": "m" } },
  "seatless_checkouts": { "Self-Improving-Agent": "main checkout carries no seat" } }
```
Then run with `cwd = <root>/<checkout>/open-brain` (create it). That is the real shape: `npm run test:heavy` runs in
`open-brain/`. `<root>` is a fresh `mkdtemp`.

- **S1** checkout `sia-builder`, no flag or env → exit 0; stdout contains `suite seat: cursor-builder (checkout sia-builder)`; meta `seat` = `cursor-builder`.
- **S2** checkout `sia-planner` → exit 0; meta `seat` = `atlas`.
- **S3** checkout `oneoff-x` (the map file present under `<root>/oneoff-x`) → exit 2; stderr contains
  `checkout oneoff-x is not in .agents/SYSTEM/hub-partner-seats.json` and `--seat`; no meta file.
- **S4** cwd = a bare `mkdtemp` directory, no map anywhere above it → exit 2; stderr contains
  `no .agents/SYSTEM/hub-partner-seats.json at or above` and `--seat`; no meta file. (If any ancestor of the temp
  directory holds `.agents/SYSTEM/hub-partner-seats.json`, STOP: `BLOCKED T-168R a seat map above %TEMP%`.)
- **S5** checkout `sia-qa` → exit 2; stderr contains `seat qa (checkout sia-qa) has no hub_name` and `--seat`; no meta file.
- **S6** checkout `Self-Improving-Agent` → exit 2; stderr contains `is seatless: main checkout carries no seat` and `--seat`; no meta file.
- **S7** checkout `sia-builder` with `--seat forge` → exit 0; stdout contains `suite seat: forge (--seat)`; meta `seat` = `forge`.
- **S8** S4's bare directory with env `SUITE_SEAT: "cursor-infra"` → exit 0; stdout contains `suite seat: cursor-infra (SUITE_SEAT)`; meta `seat` = `cursor-infra`.
- **S9** the source of `src/cli-suite-run.ts` does not contain `?? "cursor-builder"`.

**Expected at commit 1 (the base):** every row RED. At the base: S1, S7 and S8 run but print no `suite seat:` line;
S2 records `cursor-builder`; S3–S6 exit 0; S9 finds the default.

## Existing tests (verdicts)

Under ruling 2, a spawn with neither `--seat` nor `SUITE_SEAT`, run from a temp directory with no map above it,
refuses before the lease. These spawn sites run that way today and would change outcome. In **commit 2**, insert
`"--seat", "cursor-builder", ` right after `CLI, ` in each argv list; nothing else in those files changes:
- `tests/t168-owner-wired.test.ts`: the `heldByOther` spawn (rows N1, N2), and the N3 spawn
  (`[FIXTURE_HOST, "--", TSX, CLI, "--meta", meta]` becomes `[FIXTURE_HOST, "--", TSX, CLI, "--seat", "cursor-builder", "--meta", meta]`);
- `tests/suite-run-meta.test.ts`: the three spawns whose argv begins `[TSX, CLI, "--owner-pid", "100"` (the
  `owned`, `missing` and `opted` runs).
Those are the ONLY existing changes (planner grep at 403f5cc2: the other spawns already pass `--seat cursor-builder`.
`t268`, `t270` and `t283` do not spawn the runner). Every other test stays green unchanged. Any other row that turns
red: STOP, `BLOCKED T-168R <test name>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t168r-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t168r-wt")` unless the launcher named one;
   `git checkout -q -b fix/t168-seat-resolve <base>`; `rev-parse HEAD` = base; porcelain empty;
   `git ls-tree --name-only HEAD docs/loops/t168-seat-resolve-brief.md` prints the path (else STOP). `npm ci` in
   `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
   `npm run test:heavy` (the tests spawn the runner in dry-run mode themselves), killing any process by name.
3. **Commit 1, `T-168: rows for the suite seat from the checkout, or a refusal naming --seat`:** the new test file
   only. `$env:NO_COLOR='1'`; in `open-brain`:
   `npx vitest run tests/t168-seat-resolve.test.ts --no-file-parallelism --testTimeout=180000`. All nine red. Paste
   the summary and the `x` rows.
4. **Commit 2, `T-168: the suite runner works out its seat from the checkout and refuses without one (D-156)`:**
   rulings 1–2 plus the five argv insertions. Run
   `npx vitest run tests/t168-seat-resolve.test.ts tests/t168-owner-wired.test.ts tests/suite-run-meta.test.ts tests/t268-owner-session-proof.test.ts tests/t270-table-control-chars.test.ts tests/t283-suite-vitest-args.test.ts tests/t289-suite-outputs-ignored.test.ts tests/pipelines/session-start --no-file-parallelism --testTimeout=180000`
   (all green), then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0). Paste all.
5. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** (edit, run `npx vitest run tests/t168-seat-resolve.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the summary and the `x` rows, `git checkout -- <file>`, porcelain empty; never commit one; paste each
   mutant's `git diff` line first):
   - **M1** cli-suite-run.ts: delete the whole `if (!resolved.ok) { ... }` block, and change
     `const seat = resolved.seat;` to `const seat = resolved.ok ? resolved.seat : "cursor-builder";` (the default
     returns). Expect **S3, S4, S5, S6** red.
   - **M2** suite-seat.ts: return `r.seat` instead of `r.hubName` for a resolved seat. Expect **S1, S2** red.
   - **M3** suite-seat.ts: for a `seat` with `hubName === null`, return `{ ok: true, seat: r.seat, source: ... }`.
     Expect **S5** red.
   - **M4** suite-seat.ts: move step 3–4 (the checkout) ahead of steps 1–2. Expect **S7** red.
   - **M5** cli-suite-run.ts: drop ` Pass --seat <hub name> (or set SUITE_SEAT).` from the message. Expect **S3, S4, S5, S6** red.
7. `git diff --name-only <base>..HEAD` shows exactly `open-brain/src/cli-suite-run.ts`, `open-brain/src/suite-seat.ts`,
   `open-brain/tests/suite-run-meta.test.ts`, `open-brain/tests/t168-owner-wired.test.ts`,
   `open-brain/tests/t168-seat-resolve.test.ts`.
8. `git push origin fix/t168-seat-resolve` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t168-seat-resolve --title "T-168: the suite runner works out its seat from the checkout, or refuses naming --seat (D-156)" --body "Brief: docs/loops/t168-seat-resolve-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 25 min); paste the `test` conclusion.

## After the merge (planner, not this run)

A heavy-suite run from a one-off clone must then pass `--seat` (or `SUITE_SEAT`). The planner adds it to every
later brief that runs `test:heavy`, and clark's launcher should pass the launching seat's hub name. The live check
(the main build): a scratch tree with the real seat map, run from a checkout named `oneoff-x`, must refuse naming
`--seat`. Run from one named `sia-builder` (dry run), it must print `suite seat: cursor-builder (checkout sia-builder)`.

## Reply

- **First line:** `READY T-168R <sha40> PR #<n>` or `BLOCKED T-168R <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
