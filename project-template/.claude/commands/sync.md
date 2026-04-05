# /sync — Doc Synchronization
Run the doc sync script to ensure all downstream files match the authoritative sources.

## Steps

1. Run: `node scripts/sync.mjs`
2. Report the output to the user
3. If any files were updated, show the list
4. If any items need manual attention, flag them

## Authoritative sources (read from)
- `package.json` → version
- `CHANGELOG.md` → latest features/fixes
- `.agents/SYSTEM/SUMMARY.md` → project status

## Downstream files (updated by script)
- `README.md` → version reference
- `.agents/SYSTEM/PRD.md` → version in table
- `knowledge-mcp/package.json` → version field

## When to run
- Before any commit
- After bumping version in package.json
- After updating CHANGELOG.md
- When `/end` runs (called by A9)
