# T-176 gitnexus-index direction — developer handoff (record 200)

**By:** Forge, `cursor-infra`, Composer 2.5. **Branch:** `loop/t176-index-direction` from `origin/master` (`bf33fe4`). **Local commit only** (push held during QA queue 202–204).

## Change

`checkGitNexusIndex` in `open-brain/src/pipelines/sync/checks.ts` now counts both directions:

- `behind` = `git rev-list --count indexed..HEAD`
- `ahead` = `git rev-list --count HEAD..indexed`
- **PASS** only when `behind=0` and `ahead=0`
- **WARN** when behind only (`ahead=0`)
- **ISSUE** when ahead only, diverged (`behind>0` and `ahead>0`), or indexed SHA absent from repo (unchanged)

Skip when no `.gitnexus/`; `--check` stays read-only.

## Evidence (local vitest, throwaway git repos)

### Red — `origin/master` `checks.ts`, test `issues when the index is ahead of HEAD`

```
AssertionError: expected 'pass' to be 'issue'
red_exit=1
```

### Green — candidate `checks.ts`, full `staleness.test.ts`

```
Test Files  1 passed (1)
Tests  19 passed (19)
exit=0
```

### Mutant `loop/t176-index-direction-mutant-behind` @ `08f9176` (ahead ignored)

`staleness.test.ts -t "diverged"`:

```
AssertionError: expected 'warn' to be 'issue'
exit=1
```

### Mutant `loop/t176-index-direction-mutant-unknown` @ `aca9911` (missing indexed SHA → pass)

`staleness.test.ts -t "indexed commit absent"`:

```
AssertionError: expected 'pass' to be 'issue'
exit=1
```
