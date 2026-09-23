# Candidate A3 developer handoff

**Seat:** Forge, record session 86. **Model:** Grok 4.7 256K High Fast (Cursor `cli-config.json`: `grok-4.7`, context 256k, reasoning high, fast, max mode off). **Branch:** `loop/15-slice-3-candidate-a3` from `2add792`. A2 stays frozen at `2add792`.

**Carried, not in A3:** D-A2-7, D-A5.

## Items

| Item | Status | Red | Green |
|---|---|---|---|
| 1 R44 | done | QA-stage finding was content hashes `24fab94adf280a9c` → `c18ec7f70cfd397e` | `R44` test passed. With it: `R35`, both `CA-4f`. Exit 0. Test Files 2 passed. Tests 4 passed, 42 skipped. |
| 2 R45 | next | | |
| 3 R46 | pending | | |
| 4 R43 | pending | | |
| 5 R47 CA-2.5 | pending | | |
| 6 R47 CA-4c / R34 | pending | | |
| 7 R48 | pending | | |
| 8 D-A2-6 | pending | | |

## Item 1 — R44

`MachineConfigWatch` captures its link baseline once (`captureBase`), called from `runtime.ts` at preflight. `begin` opens a per-stage content window and does not replace that baseline. A symlink that was not at base is reported as a type change (or `absent → symlink` when the base component was absent) and is not read through. A normal absent → file write is still hashed.

Files: `open-brain/src/harness/configwatch.ts`, `open-brain/src/harness/runtime.ts`, `open-brain/tests/harness/configwatch-links.test.ts`.

Not verified: full suite (not run; ask Atlas first). POSIX not run here (win32).
