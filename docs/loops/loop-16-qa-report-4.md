# Loop 16 — QA report 4: the version bump `ca1693f`, verified in scope

**By:** Probe (QA seat; session uuid `6eab2c5c`) · **Date:** 2026-09-21 ·
**Subject:** `ca1693f` — one commit above the accepted candidate `5351270` ·
**Criteria:** `75f05eb` · **Reports 1–3:** `a13f3c5`+`ef79340`, `c1b977a`, `87b4cef` ·
**Precedent:** Loop 14's `3135da4`, verified the same way.

**This is a bridge report, not a verdict.** The verdict is report 3's: **ACCEPTED at `5351270`**.
What follows is the in-scope check that the bump changed only what a bump may change.

---

## Result — IN SCOPE

The diff touches only the release files and the four rendered views, the record is unchanged, the
targeted set still exits 0, and the CHANGELOG gate passes **and is shown able to fail**.

## 1. Structure

`ca1693f` is a commit, **exactly one** above `5351270`, which is its parent lineage. Tree detached
to it, `git status --porcelain` empty before and after, build stamped `ca1693f`, `tsc --noEmit` 0.

## 2. The diff — seven files, nothing else

| file | change |
| --- | --- |
| `package.json` | `0.43.0` → `0.44.0`, the version line only |
| `CHANGELOG.md` | +69 |
| `README.md` | +29 |
| `.agents/SUMMARY.md`, `INBOX.md`, `task.md`, `next-session.md` | the generator's version line (and SUMMARY's `Status:` line, which embeds it) |

- **`git diff --name-only 5351270..ca1693f -- open-brain/src/` is empty.** No source change.
- **`.agents/state.json` is untouched** — byte-identical between the two commits, and the gate's own
  `state-schema [pass]` reads **schema v2, rev 59**, unchanged from the accepted candidate.
- The four views changed on their generator line alone; **every one still reads `rev 59`.** The
  re-render is `sync` stamping the new version into text it generates, which is what a bump does.

**The CHANGELOG and README text was recovered by reverting the revert of `4a9b056`**, so the history
shows the text existed, was withdrawn under `R24`, and returned — rather than being retyped. The
content is then updated with the accepted SHA, the two rejections by row, amendments 9–12 and the
live result.

## 3. The CHANGELOG gate — read, then tested, then controlled

`sync --check` reports **27 passed, 0 fixed, 3 warnings, 0 issues, 0 skipped** at `v0.44.0`; the
three warnings (`prd-version`, `vault-index-parity`, `spec-provenance`) are the pre-existing
seat-tree conditions present at base.

**But `changelog` is not in the printed REPORTED block** — only "reported" checks print — so a green
summary alone cannot distinguish *the gate passed* from *the gate did not run*. **Skip is not pass;
silence is not all-clear.** Three steps instead:

1. **Read the matcher** rather than infer it (as the developer did):
   `new RegExp('## \\[v?' + version.replace(/\./g,'\\.') + '\\]')` — `checks.ts:115`.
2. **Apply it by hand** to the file: matches, and the heading it finds is `## [0.44.0]`. A control
   pattern for `0.99.0` does not match.
3. **Call the gate directly from the candidate's build, with a control version:**
   - `checkChangelog('0.44.0', root)` → `{severity: "pass", "CHANGELOG.md has entry for v0.44.0"}`
   - `checkChangelog('9.99.9', root)` → `{severity: "issue", "CHANGELOG.md missing entry for v9.99.9"}`

**So the gate ran, passed, and is able to fail.** `checkReadmeRefs` likewise passes with all 2
script references resolving.

## 4. Tests

**Targeted set** (my enlarged version): **15 files, 211 tests, exit 0**, exit code written to a file
and read back. Unchanged from `5351270`, which is what a docs-and-version commit should leave.

The full suite was not re-run at this commit: no source changed, and report 3 §9 carries the
green run at `5351270` — **stated rather than implied**, so nobody reads a number here that was
measured one commit earlier.

## 5. One instrument failure of mine, for completeness

Reading `state.json`'s revision with an inline `python -c json.load(open(...))` threw
`UnicodeDecodeError: 'charmap' codec can't decode byte 0x9d` — Python's default cp1252 on Windows
against a UTF-8 record. **My instrument, not a finding**, and the fact it was checking was already
established twice over: the `git diff` for that path is empty and the gate reports rev 59.

## 6. What this report does not say

It does not re-open the verdict, and it does not carry evidence from `5351270` forward as if
measured here. The accepted SHA is `5351270`; `ca1693f` is that plus a version bump, and the only
claim made here is that the bump is what it says it is.
