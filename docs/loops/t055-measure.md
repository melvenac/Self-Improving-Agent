# T-055 measure — GitNexus incremental analyze (QA PC)

**Date:** 2026-10-04. **Seat:** forge. **Scratch:** `C:\Users\Aaron Melven\scratch\t055-gnx` (local clone, detached, never a seat tree). **Base:** `b20d574f` then small probe commits. **Lease:** D-119 `machine-lease.ps1 take` via `-File`, owner pid 11992, released after the runs.

## Versions

| What | Value |
|------|--------|
| gitnexus on PATH | none (`Get-Command` failed) |
| npm global | empty |
| Measured CLI | `npx --yes gitnexus@1.6.12` (prints `1.6.12`) |
| npm registry `gitnexus` | `1.6.12` (not newer; no second series) |
| Runner recorded in `.gitnexus/meta.json` | cursor-agent `node.exe` v24.5.0, ABI 137 |
| FTS load | needs `C:\Program Files\Git\mingw64\bin` on PATH (OpenSSL). Without it, analyze exits 0 and warns BM25 is disabled. `--repair-fts` then exits 1. |

## Series A — FTS extension not loaded (default PATH)

Command: `npx --yes gitnexus@1.6.12 analyze --index-only --skip-skills` after each one-line commit to `docs/loops/t055-probe.txt`.

| Run | Exit | Wall s | Old FTS inconsistency (`file_fts` / missing during delete) |
|-----|------|--------|--------------------------------------------------------------|
| full-1 | 0 | 253 | no (warning: FTS extension unavailable) |
| incremental 00a77f10 | 0 | 147 | no |
| incremental 5e27d0cb | 0 | 104 | no |
| incremental 2d5f10f2 | 0 | 43 | no |
| incremental da4ff7f5 | 0 | 31 | no |
| incremental a8979ac0 | 0 | 41 | no |
| `--repair-fts` (no DLL path) | 1 | 72 | cannot repair; extension failed to load |
| `--force` | 0 | 34 | no (same FTS-unavailable warning) |

## Series B — FTS loaded (`GITNEXUS_LBUG_EXTENSION_INSTALL=auto` and Git `mingw64\bin` on PATH)

`--repair-fts` first: exit 0, "FTS indexes repaired successfully" (about 38 s). Then five more probe commits and plain `analyze`:

| Run | Exit | Wall s | Inconsistency |
|-----|------|--------|----------------|
| e9a42b17 | 0 | 39 | no |
| cd58fb65 | 0 | 129 | no |
| 6f77a203 | 0 | 142 | no |
| 508e51f9 | 0 | 84 | no |
| 656de832 | 0 | 66 | no |

After the last run, `.gitnexus/meta.json` `lastCommit` was `656de832562d9882cbc0e9acacc539e85247f302` and `ftsProfile` was `full`.

**Result:** on gitnexus 1.6.12 the 2026-09-20 incremental failure (FTS index `file_fts` inconsistent, missing during delete; six of six in the QA tree) did **not** recur. The crash cannot be observed while the FTS extension fails to load; with the extension loaded, five incrementals still exited 0.

## Flags tried

- `--repair-fts` — fails until the FTS DLL loads; then rebuilds search indexes without a full re-parse message ("repaired successfully").
- `--force` — full rebuild; still skips FTS when the extension will not load.
- `--index-only` `--skip-skills` — used so analyze does not rewrite AGENTS.md or CLAUDE.md.
- `gitnexus clean` was **not** used (G-043: exit 0 deletes nothing without `--force`).

## Minimal repro (for a later upstream issue; not filed)

1. Scratch clone of this repo at a known SHA.
2. `npx --yes gitnexus@1.6.12 analyze --index-only --skip-skills`
3. Commit a one-line file change.
4. Run the same analyze again.
5. On Windows, prepend `C:\Program Files\Git\mingw64\bin` to PATH and set `GITNEXUS_LBUG_EXTENSION_INSTALL=auto`, then `analyze --repair-fts`, then repeat step 4.
6. Failure shape from T-055 / G-043 (not seen here on 1.6.12): exit 1, text `file_fts` and `inconsistent` or `missing during delete`.

## T-187 plan (code waits until checks.ts is free)

See the hub freeze reply. Proof field already used by `gitnexus-index`: `.gitnexus/meta.json` `lastCommit` compared to HEAD (`checks.ts`).
