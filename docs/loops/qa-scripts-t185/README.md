# QA 120 (T-185) scripts

These are the scripts behind `docs/loops/t185-qa-report.md`. Each one runs against a **built scratch clone**, never
against the checkout it lives in. On the QA PC the clones are `C:\qa-scratch\t185` (candidate `9473b0d`) and
`C:\qa-scratch\t185-base` (base `8af41dd`). Build each clone with `npm ci && npm run build` in `open-brain/`.
Fixtures go under `os.tmpdir()`, which is `C:\qa-tmp` here (T-190).

| File | What it does | How to run it |
|---|---|---|
| `probes.mjs` | Runs 75 probes: the developer's typos, QA's own typos, and a control per command that proves the fixture would change. Each probe gets a fresh fixture and a byte snapshot of the whole target, `.git/` included. The snapshot is taken **before** any git command runs, because `git status` can rewrite `.git/index`. DB, vault, slot, score history, shadow log and HOME are all redirected into a per-probe scratch directory. | `node probes.mjs <tree> <label>` writes `C:\qa-scratch\t185-probes\<label>.json` |
| `bootstrap-probe.mjs` | R185-1. Runs `cli-bootstrap.js` as `setup.mjs` registers it and with 5 typo variants, each against a Claude-shaped and a Cursor-shaped payload. Records the slot key and its `ide`. | `node bootstrap-probe.mjs <tree>` |
| `hooks-probe.mjs` | Runs the SessionStart, SessionEnd and PostToolUse(Bash) hooks as README.md:115-117 registers them (no argv, payload on stdin), against a scratch project, DB and vault. | `node hooks-probe.mjs <tree>` (unset `KNOWLEDGE_V2_DB` first) |
| `doc-invocations.mjs` | Uses `git grep` over **every** tracked file (docs/loops included) to find `cli.js <sub>` and `open-brain <sub>` invocations, then parses each one with the candidate's own `parseArgs` and `COMMAND_SPECS`. | `node doc-invocations.mjs <tree>` |
| `qa120-inscratch.test.ts` | Attacks `inScratch()`. The cwd and junction attacks are refused. An absolute positional outside the temp dir is **not** looked at, and a fixing sync runs on the stand-in. `QA120_VICTIM` must be a stand-in project **outside** the temp dir, never the real repository. | copy it to `open-brain/tests/` in a scratch clone, then `QA120_VICTIM=C:\qa-scratch\t185-victim npx vitest run tests/qa120-inscratch.test.ts` |
| `qa120-t185.test.ts` | QA's extra e2e rows: the refusal comes before the DB is opened (relocate ×2, topics), migrate typos the developer did not try, a typo after the positional, and the em-dash row. The em-dash row is **expected red at `9473b0d`** (D1). It is pushed as `qa/t185-qa-tests`. | copy it to `open-brain/tests/`, then `npx vitest run tests/qa120-t185.test.ts` |
| `out/` | The recorded outputs these scripts produced in this session, for comparison. | |

## QA mutants (branches off `9473b0d`, pushed with `push-qa.mjs`)

| Branch | SHA | Mutation |
|---|---|---|
| `qa/t185-mut-single-dash` | `dad8023` | `cli-args.ts`: `if (/^-[^-]/.test(tok)) continue;` goes before the positional test, so any single-dash token is accepted and ignored. |
| `qa/t185-mut-walkup` | `2ac19e7` | `cli-args.ts`: a missing directory walks up to its nearest existing ancestor instead of refusing. |
| `qa/t185-mut-db-before-parse` | `ba19f19` | `cli.ts`: `relocate` parses its flags **after** `openV2Database`. |
| `qa/t185-qa-tests` | `a96ed1f` | Not a mutant. It is the candidate plus `qa120-t185.test.ts`. |
| (local only) `qa-local/mut-detach-read-typo` | not pushed | `cli.ts`: detach reads `opts.has("--dry-rn")`. |
