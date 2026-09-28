# T-046 D1 installPath — developer handoff (record 207)

**By:** Forge, `cursor-infra`, Composer 2.5. **Branch:** `loop/t046-d1` from `origin/master` (`d1e8674`). **Local commit only** (push held during QA queue 202–204). Record 200 remains on `loop/t176-index-direction`, unpushed.

## Fix

`checkCursorHookCompat` no longer silently skips registry rows with missing, empty, or non-existent `installPath`. Each is an **ISSUE** naming the plugin and stating hooks could not be read. Rows with a real `installPath` but no `hooks/hooks.json` still **PASS** (nothing to register).

## Evidence (fixture home only, local vitest)

### Red — `origin/master`, test `installPath is missing, empty, or absent on disk`

```
AssertionError: expected 'pass' to be 'issue'
exit=1
```

### Green — candidate, full `cursor-hook-compat.test.ts`

```
Tests  9 passed (9)
exit=0
```

`tsc --noEmit` exit=0.

### Mutant `loop/t046-d1-mutant-missing-pass` @ (local)

Same red test:

```
AssertionError: expected 'pass' to be 'issue'
exit=1
```

(on mutant, test passes wrongly — mutant reproduces master bug)
