# Candidate A3 developer handoff

**Seat:** Forge, record session 86. **Model:** Grok 4.7 256K High Fast (Cursor `cli-config.json`: `grok-4.7`, context 256k, reasoning high, fast, max mode off). **Branch:** `loop/15-slice-3-candidate-a3` from `2add792`. A2 stays frozen at `2add792`.

**Carried, not in A3:** D-A2-7, D-A5.

## Items

| Item | Status | Red | Green |
|---|---|---|---|
| 1 R44 | done | QA-stage finding was content hashes `24fab94adf280a9c` → `c18ec7f70cfd397e` | `R44` test passed. With it: `R35`, both `CA-4f`. Exit 0. Test Files 2 passed. Tests 4 passed, 42 skipped. |
| 2 R45 | done | `v.ok` was true (the absent `<git-dir>/info` junction was not a change) | 3 passed: the repo root, the machine-config absent → link, and the existing `.git/info` junction. Exit 0. |
| 3 R46 | done | tree root named only the files under it as deleted; an entry's after was `symlink:<target>` without `type:`; baseNotes on a parent junction was empty | 7 passed (R45, R46, existing hooks junction and entry). Exit 0. |
| 4 R43 | done | repo after was `f6c637173221f649/666/nlink:2` (the victim hash); machine after was `712138997b4c155f` | full `configwatch-links` file: 18 passed, 3 skipped (POSIX). Exit 0. |
| 5 R47 CA-2.5 | done | with `resolveLauncher`'s node-entry branch forced to refuse: `mutant: refusing node entry …planted-launcher.js`, expected false to be true. Exit 1. | after the mutant was removed: 2 passed (planted launcher and real `claude`), 22 skipped. Exit 0. |
| 6 R47 CA-4c / R34 | done | M-L0 (layer 0 not applied): `the global filter ran inside a runtime git call: expected [ 'global:', 'global:', … ] to deeply equal []`. Exit 1. | layer 0 restored: 4 passed, 28 skipped. Exit 0. System `core.autocrlf` on this machine is `true`, not `input`. |
| 7 R48 | done | | CI test step is `npm test -- --reporter=verbose`. Nothing else in the workflow changed. Not run here. |
| 8 D-A2-6 | next | | |

## Item 1 — R44

`MachineConfigWatch` captures its link baseline once (`captureBase`), called from `runtime.ts` at preflight. `begin` opens a per-stage content window and does not replace that baseline. A symlink that was not at base is reported as a type change (or `absent → symlink` when the base component was absent) and is not read through. A normal absent → file write is still hashed.

Files: `open-brain/src/harness/configwatch.ts`, `open-brain/src/harness/runtime.ts`, `open-brain/tests/harness/configwatch-links.test.ts`.

## Item 2 — R45

A watched tree root that was absent when the window opened, and is a link at close, is a `created` change (`absent → symlink:<target>`). The restore removes the link and does not `mkdir`. A tree that was a real directory is still recreated. Machine-config paths stay detect-only: absent → link is reported with the target, not read, not restored (Atlas ruling on R44/R45).

## Item 3 — R46

Every symlink tree root is recorded as `type:symlink readlink:<target>`, including one that was a real directory (the files under it are no longer the only record). A symlink entry uses the same after-string. `baseNotes` walks each path component with `lstat` and names a link at a parent, with its type and readlink target.

## Item 4 — R43

`readState` compares `dev`, `ino` (`{ bigint: true }`) and `nlink` with the baseline before `readFileSync`. A mismatch is recorded as `identity:…; not read` and the bytes are not read. A new hard link (`nlink` other than 1, no baseline file) is not read either. `MachineConfigWatch` applies the same comparison and does not hash through it.

## Item 5 — R47, CA-2.5

The control that returned early when `claude` was absent is now two tests. A planted launcher is accepted and resolved on every platform (win32: a `.js` shim as `node-entry`; POSIX: an executable script as `native`), and a refusal twin runs beside it (win32: a `.cmd` with no npm-shim target; POSIX: a directory). The real `claude` launcher is its own test, `it.skipIf` when `claude` is not on `PATH`, with that reason in the title.

## Item 6 — R47, CA-4c and R34

The global-filter row plants `HOME/.gitconfig` and an empty scratch `XDG_CONFIG_HOME`, with `GIT_CONFIG_GLOBAL` unset, so git's own discovery is what layer 0 has to hide. The R19 row asserts the planted value `core.autocrlf = input`, and that the system value is not `input`.

Not verified: full suite (not run; ask Atlas first). POSIX not run here (win32).
