# T-050: a foreign `.recalled-entries.json` writer is now observable

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t050-foreign-writer` from `origin/master` `00552846`. **Code SHA to freeze: `ddea392b37a9a6b6abbeb0cf7e0b230d06e14e9d`.**
Not merged. LIGHT job: touched tests, `tsc --noEmit`. v0.15.1 is not reopened: `resolveRecalledIds` is unchanged and its precedence (explicit ids, `recall_log`, the file only when it names this session, nothing) is untouched.

## What it does
`pipelines/session-end/recalled-ids.ts` gains:
- `detectForeignWriter({ sessionId, filePaths, readFile })`: reads each candidate file **only to report who wrote it**. It returns `{ sessionId, checked, notChecked?, looked, present, findings[] }` and **no ids, no entries**. A finding is `foreign` (names another session), `unattributed` (names none) or `unparseable`.
- `formatForeignWriter(report)`: always one or more lines, so the answers differ:
  - `Foreign writer: none present (no .recalled-entries.json in N location(s))` (no file anywhere)
  - `Foreign writer: none (N file(s) read, all name this session)`
  - `Foreign writer: not checked (no session id, so no file can be called foreign)`
  - `Foreign writer: FOUND <path> names session X, not Y (reported, not refused; it played no part in which entries were rated)`
- `resolveRecalledIdsObserved(input)`: `{ resolved, foreign }`, where `resolved` is exactly `resolveRecalledIds(input)`.
Wired into the three places that already resolve: `ob_end` (`server.ts`, in its resolution lines), `ob_recalled` (`server.ts`, a closing line, and after the "No knowledge entries recalled" text), and the session-end hook (`cli-session-end.ts`, beside `Recalled ids:`).

## Evidence
- **Red before:** the 6 new rows (`FW-1` to `FW-6`, `recalled-ids.test.ts`) fail because the functions do not exist (the file did not load them).
- **Green after:** `recalled-ids.test.ts` 23 passed (23). Adjacent: `session-end/index-v2.test.ts` 9, `t048-r3.test.ts` 5, `t003-r2.test.ts` 9, `server.test.ts` 30, all passed. `tsc --noEmit` exit 0.
- Rows: `FW-1` a foreign-writer fixture is reported (path and the session it names); `FW-2` our own file is not a finding; `FW-3` an absent file says `none present`, which differs from `not checked`; `FW-4` an unparseable file and a file naming no session are reported by kind; `FW-5` the resolver's ids, origin and rejection are identical with and without the detector, including a foreign file carrying ids; `FW-6` the report holds no `ids` or `entries` key.
- **Mutant** (the detector's read feeds the resolver: the file's ids appended to `resolved.ids` inside `resolveRecalledIdsObserved`): `FW-5` goes red, 1 failed | 22 passed. Reverted.

## Not covered
No test drives `ob_end` or `ob_recalled` end to end to see the new line in their text; the wiring is three call sites, type-checked, and the existing tests of both handlers pass. A foreign file naming OUR session is by definition not foreign here: the detector compares session ids only, so it reports a writer that names a different or no session, not one that forges ours.
