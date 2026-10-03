# T-235 park handoff — sia-builder (cursor-builder)

**Parked:** 2026-10-03 (Aaron: all Cursor devs until hub waker proven).

## Branch + SHA

- **Branch:** `docs/t235-cursor-parity-phase1`
- **Head:** `29fea1850e035c27bc38343c285da1a15549c5f0` (`29fea185`)
- **PR:** https://github.com/melvenac/Self-Improving-Agent/pull/358 (docs-only)

## Done

- Phase 1 audit `docs/loops/cursor-parity/audit.md`: round 1 (config reads + greeting rows A–D) and **round 2 live `cursor-agent`** in scratch `C:\Users\Aaron Melven\scratch\t235-hooks` (hook logger, active-session before/after, MCP ppid chain / missing `by-pid/11548`, `/task` resolution, `setup.mjs` idempotence on scratch `HOME`).
- Hub: greeting (turn 72), Phase 1 complete, round 2 report (turn 82). Key rotated on QA PC earlier in session.
- Checkout on `origin/master`; tree rev 303 at park time.

## Next (when unparked)

1. Atlas ruling on PR #358 round 2 (Windows hook stdin empty — may need temp `payload.json` or async stdin before rows 3–5 are fully accepted).
2. Phase 2 fixes only after planner rules ranked list (T-003 / SessionEnd / recall / setup gaps).
3. Do **not** leave `USERPROFILE`/`HOME` on scratch paths during hub or git work (breaks `~/.a2a-hub` key lookup).

## WIP / not committed

- Scratch experiment artifacts stay on disk under `scratch\t235-hooks\` (not in repo).
- Untracked hub paste files under `docs/loops/cursor-parity/` (`hub-*.txt`) — optional delete; not required for resume.
