# T-194 developer handoff: planner seat PreToolUse hook

**By:** Forge (developer), record **214**, 2026-09-28.
**Branch:** `loop/t194-planner-hook` (from `origin/master` `8467cb1`).
**Brief:** `docs/loops/t194-t195-dispatch.md` §Record 214 at `496ba4c`.
**D-061:** local tests only; no CI dispatched.

## What shipped

- `open-brain/src/cli-planner-hook.ts` — PreToolUse entry (stdin JSON, exit 2 + `permissionDecision: deny` on refusal).
- `open-brain/src/planner-hook/` — policy modules (`run.ts`, `paths.ts`, `summary.ts`, `bash.ts`, `git.ts`, `grant.ts`, `emit.ts`, `registration.ts`).
- `open-brain/tests/planner-hook/hook.test.ts` — PH-1..PH-8 rows.
- Grant path: `open-brain/.planner-outward-grant` (under PH-1; planner cannot create it via Edit/Write). Aaron places the file; one use consumes it.
- D-032 `gh pr merge`: hook calls `gh pr view … --json files` and allows only when every path is on the docs-merge allowlist; otherwise PH-3 grant or deny.
- Registration: `node open-brain/build/cli-planner-hook.js --print-registration` prints the `settings.local.json` snippet. **Not registered** — Aaron's hand.

## Local proof

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p open-brain` | exit **0** |
| `npx vitest run open-brain/tests/planner-hook/hook.test.ts` | exit **0**, **39 passed** |

## Row map

| Row | Test(s) | Red | Green |
| --- | --- | --- | --- |
| **PH-1** | `PH-1 — artifact writes denied` (4) | `loop/t194-planner-hook-mut-ph1` — vitest **1 failed**, 38 passed | this branch, 39 passed |
| **PH-2** | `PH-2 — rendered views…` (6) | `loop/t194-planner-hook-mut-ph2` — **2 failed**, 37 passed | 39 passed |
| **PH-3** | `PH-3 — outward git acts need grant` (7) | `loop/t194-planner-hook-mut-ph3` — **3 failed**, 36 passed | 39 passed |
| **PH-4** | `PH-4 — allowed planner acts` (7) | `loop/t194-planner-hook-mut-ph4` — **1 failed**, 38 passed | 39 passed |
| **PH-5** | `PH-5 — fail closed…` (3) | `loop/t194-planner-hook-mut-ph5` — **1 failed**, 38 passed | 39 passed |
| **PH-6** | `PH-6 — Bash write detection` (5) | `loop/t194-planner-hook-mut-ph6` — **1 failed**, 38 passed | 39 passed |
| **PH-7** | `PH-7 — JSON parser…` + mutant turns deny→allow on malformed JSON | `loop/t194-planner-hook-mut-ph7` — **1 failed**, 38 passed | 39 passed |
| **PH-8** | `PH-8 — CLI deny contract…` (3) + registration | `loop/t194-planner-hook-mut-ph8` — **1 failed**, 38 passed | 39 passed |

Mutant tips are filled in after the mutant commits (see below).

**Red on master:** no hook and no test file — boundary is prose-only (`planner.md`).

## PH-8 live check (not run here)

After Aaron registers the snippet in the planner checkout: one denied `Edit` to `open-brain/src/` and one allowed `Write` under `docs/loops/`, with refusal text quoted in the ruling. PreToolUse deny-wins across hooks (context-mode plugin) is host behaviour; this hook emits exit **2** and `permissionDecision: deny` on stdout.

## Mutant branches (local only, not for merge)

| Branch | Defect | SHA |
| --- | --- | --- |
| `loop/t194-planner-hook-mut-ph1` | skips `isProtectedArtifactPath` | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph2` | skips rendered-view deny | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph3` | ignores grant / outward deny | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph4` | denies `docs/loops/` writes | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph5` | missing `AGENT.local.md` → passthrough | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph6` | `detectBashWriteTargets` always `[]` | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph7` | regex on raw JSON instead of `JSON.parse` | _(after commit)_ |
| `loop/t194-planner-hook-mut-ph8` | deny exits **0** | _(after commit)_ |
