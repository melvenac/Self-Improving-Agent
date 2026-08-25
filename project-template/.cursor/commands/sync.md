# /sync — Doc Synchronization (Cursor + SIA)

Run the **open-brain** `ob_sync` MCP tool to ensure downstream files match authoritative sources.

## Steps

1. Call `ob_sync` with `project_root` set to the current working directory
2. Report output to {{USER_NAME}}
3. List any files auto-updated
4. Flag manual attention items
5. Health score: `ob_sync` with `score: true` or `ob_score` directly

## Authoritative sources

- `package.json` → version
- `CHANGELOG.md` → latest features/fixes
- `.agents/SYSTEM/SUMMARY.md` → project status

## Downstream (updated by ob_sync)

- `README.md`
- `.agents/SYSTEM/PRD.md`
- `docs/PRD.md` (if present)

## When to run

- Before any commit
- After version bump or CHANGELOG update
- During `/end` (step A9)
