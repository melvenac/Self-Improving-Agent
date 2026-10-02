# T-042: a detector for test artifacts in the vault

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t042-vault-pollution` from `origin/master` `5ec37cdf`. **Code SHA to freeze: `41c87b16c2aadbd1a268277911c372d604c095e8`.** Not merged. LIGHT: one test file per run, `tsc --noEmit`.

## What it is
`open-brain/src/pipelines/sync/vault-pollution.ts` (new; **not** `checks.ts`): `checkVaultPollution(projectRoot, vaultDir?)`, with the vault resolved by `obsidianVaultDir()` when none is given. It walks the vault (dot-folders such as `.obsidian` and `.git` skipped) and counts `.md` notes named `ob-server-<slug>.md` or `<date>-ob-server-<slug>.md`: the shape the suite wrote into the real vault in April (57 files) and on 2026-08-31 (13).
- **Seeded vault:** `warn`, with the count and the vault-relative paths (first 10, then "+N more").
- **Clean vault:** `pass`, saying how many notes it read and how many directories it could not list ("0 ob-server-* files in N .md files under the vault; 0 directories unreadable"). A directory it cannot list is counted and named, so a clean-looking scan cannot hide an unreadable folder (the T-048 invariant).
- **Absent or unreadable vault:** `skip`, "not checked: no readable vault at <path>… This is not a pass." A vault path that cannot be resolved (the test-run guard) is also `skip`.
- LIMIT stated in the source: a file-NAME rule only. A test artifact named another way is not seen, and no note is read. T-042's "any `mkdtemp`-shaped slug" and the root-level vitest guard (its optional second half) are **not** done.

## Registration in sia-forge's file: two lines, said plainly
`open-brain/src/pipelines/sync/index.ts`: an `import { checkVaultPollution } from "./vault-pollution.js";` line and `checks.push(checkVaultPollution(options.projectRoot));` beside `checkProbeMarkers`, with a one-line comment. You asked for one line; it is the registration pair, and nothing else in that file changed. `sync/checks.ts` is untouched.

## Evidence
- New `tests/pipelines/sync/vault-pollution.test.ts`, 5 rows: VP-1 seeded vault warns with count and paths (including a nested folder); VP-2 clean vault passes and reports its notes and unreadable-directory counts, `.obsidian` ignored; VP-3 absent vault is `skip`/"not checked"; VP-4 an unreadable directory (injected `readdir`) is counted and named; VP-5 near-misses (`.txt`, a folder named `ob-server-folder`, `server-ob.md`) do not count.
- **Red before:** the file fails to load with the module absent (renamed away for the run). **Green after:** 5 passed (5).
- **Mutant** (the walk does not descend into folders): 3 failed | 2 passed (VP-1, VP-2, VP-4). Reverted.
- Neighbours, one file per run: `sync/index.test.ts` 4 passed, `greeting-size.test.ts` 11 passed. `tsc --noEmit` exit 0.
- **Live:** `sync --check` on this checkout now prints `vault-pollution [pass]: 0 ob-server-* files in 9 .md files under the vault; 0 directories unreadable` (summary 31 passed, 3 warnings, 4 issues, 1 skipped; the warnings and issues are the standing ones). That vault is whatever `obsidianVaultDir()` resolves on this PC; I did not look at Aaron's real vault.
