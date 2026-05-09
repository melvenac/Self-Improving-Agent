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
