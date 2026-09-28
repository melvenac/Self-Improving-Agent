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

### Mutant `loop/t176-index-direction-mutant-behind` (ahead ignored; diverged reads as behind-only warn)

`staleness.test.ts -t "diverged"`:

```
expected 'issue' to be 'warn'
exit=1
```

### Mutant `loop/t176-index-direction-mutant-unknown` (missing indexed SHA treated as pass)

`staleness.test.ts -t "indexed commit absent"`:

```
expected 'issue' to be 'pass'
exit=1
```
