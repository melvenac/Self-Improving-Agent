# /sync — Doc Synchronization
Run the ob_sync tool to ensure all downstream files match the authoritative sources.

## Steps

1. Call `ob_sync` with `project_root` set to the current working directory
2. Report the output to the user
3. If any files were updated, show the list
4. If any items need manual attention, flag them
5. For health scoring, call `ob_sync` with `score: true` or use `ob_score` directly

## Authoritative sources (read from)
- `package.json` → version
- `CHANGELOG.md` → latest features/fixes
- `.agents/SYSTEM/SUMMARY.md` → project status

## Downstream files (updated by script)
- `README.md` → version reference
- `docs/PRD.md` → version in table (if present)
- `.agents/SYSTEM/PRD.md` → version in table (if present)

## When to run
- Before any commit
- After bumping version in package.json
- After updating CHANGELOG.md
- When `/end` runs

## Doc sync map

Authoritative sources → downstream consumers:

```
package.json (version)  ──→ README.md, PRD.md
CHANGELOG.md (features) ──→ README.md (manual — script flags missing entries)
SUMMARY.md (status)     ──→ Referenced by /start, not auto-synced
```

Run `/sync` (calls `ob_sync`) to detect drift without fixing.

## Protocol health

`ob_score` or `ob_sync --score` — deterministic 0-100 health score across 5 categories (config, knowledge quality, staleness, coverage, pipeline health). Score auto-appends to history. `ob_score --history_only` shows trend.
