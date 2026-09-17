# Loop 12 — C1 boundary report: what a deletion has to reach

**Base:** `master` @ `ae1988d`, state rev 25 — checked, not assumed (`git rev-parse` + `ob_start`).
**Branch:** `loop/12-deletion`, in its own worktree (`~/Projects/sia-loop12`), per T-149.
**Read before writing:** `docs/loops/loop-11-closeout.md`, `docs/loops/loop-12-brief.md`, `e0b2fc8` in full.

---

## C1.0 — The eighteen referrers have no list

**The number is asserted in four places and the list exists in none of them.** `CHANGELOG.md:85`,
`loop-11-closeout.md:37`, `loop-12-brief.md:29` and `Session_62.md:53` all say *eighteen*. `e0b2fc8`'s
commit message names **nine** of them in prose. No file anywhere enumerates the set.

**This is C3's thesis arriving before C3 starts.** The brief says the referrers "are recorded in
`e0b2fc8`". They are counted there; they are not recorded. A count is not a record, and the
difference is exactly why the ruling was expensive two loops later — rule 7, *the title is not the
record*, one layer down.

Reconstructed below from `e0b2fc8`'s message and CHANGELOG entry, plus `git grep` at `e0b2fc8^`.
**The reconstruction totals 19, not 18.** I cannot close the gap: the three untracked mirrors were
counted on disk at ruling time and that disk state is unrecoverable from git. Stated rather than
rounded.

## C1.1 — Classification of the worked example

| class | n | what is in it |
|---|---|---|
| **machine-checkable** | **11** | three `skill-scan.md` command copies · `/skill-scan` as a command-table row (root `README.md`, `project-template/README.md`, `FRAMEWORK.md`) · `knowledge-mcp/scripts/skill-scan.mjs` in `harness-audit.md` · two hook scripts in `SECURITY.md` · `/sync`'s `vault-index-parity` output strings · `RULES.md`'s hook order · `LIFECYCLE.md` |
| **prose-only** | **5** | six source-comment mentions describing rationale (`store/index.ts:83`, `topics/index.ts:15`, `server.ts:967`, `paths.ts:35`, `vault-writer.ts:105`, `setup.mjs:348`) · `domains.json`'s description · `RUNBOOK.md` · `self-improving-agent-guide/SKILL.md` |
| **historical** | **3** | `DECISIONS.md` · `PRD.md` · `mcp-tool-audit-2026-08-08.md` |

**~58% of the worked example is machine-reachable.** That is the honest ceiling on C2, and it is
higher than the brief assumed — good news, load-bearing, and it is the reason C2 should lead with
file-and-command paths rather than tool names.

## C1.2 — THE CUT IS NOT FINISHED. Root `README.md` still ships it.

**`README.md:160` lists `/skill-scan` in the live Commands table**, present tense, as a command the
project has. Lines 121 and 167 name it as a stage of the session-end pipeline that was cut in Loop 10.

`e0b2fc8` repaired `project-template/README.md`. **It never touched the repo's own `README.md`** —
the front door, tracked, in every PR since, through two merges, a close-out that says the cut was
executed, and a brief that uses it as the worked example of a finished retirement.

**This is the loop's subject demonstrating itself on the artifact chosen to illustrate it.** Read at
`ae1988d`, not inferred: `grep -n` then `sed -n '152,170p'`.

## C1.3 — A fourth bucket the three-way scheme has no home for

Four live files name `skill-scan` **correctly** — `SKILL.md:65`, `RUNBOOK.md:62`,
`domains.json:2`, `INBOX.md:54` — each saying, in substance, *"skill-scan was cut in Loop 10."*

**C3 as specified would fire on all four.** "Nothing outside the historical set still names it" is
true of a dangling reference and equally true of a correct obituary. Path-scoping cannot separate
them: these are live governing files, not archives.

**So the retirement record needs an allowed-*form*, not only an allowed-*path*** — a retired name
cited alongside its retirement is the record working, not the record rotting. Rule 8 in structural
form: the substring is identical and the question is not.

**Test fixtures are the same problem from the other side.** `tests/fixtures-import/` is a frozen
snapshot whose job is to name an old tree (`knowledge-mcp/package.json`, `shared/state-writer.ts`).
It is not historical by path and not prose. **Both must be excluded by rule, or C3 ships loud and
gets ignored** — which is how a check dies.

## C1b — The event classes that end a name

A ruling of `CUT` is the minority case. Of Loop 11's 25 Q1 defects the two largest clusters —
the `knowledge-mcp` → `open-brain` rename and the retired `kb_*` prefix — **were never ruled CUT by
anyone.** The record must key on the event, not the verdict:

| class | instance in this repo | ends a name? |
|---|---|---|
| component cut | `/skill-scan`, `dream`, `db.ts`, the maturity lifecycle | yes |
| module/package rename | `knowledge-mcp` → `open-brain` | yes |
| identifier prefix retired | `kb_*` → `ob_*` | yes |
| flag / subcommand removed | `--check-only` (never existed — T-150's mirror) | yes |
| dependency dropped | Smart Connections, the v1 vault | yes |
| **field removed from a schema** | `project.version` (ADR-027, V-022) | **yes — and it is the one the brief omits** |

**Every row ends with the same sentence: a name that used to resolve no longer does.** `project.version`
is added because it is the only one with a *working* propagation story — a file still carrying it
fails parse, so a missed copy is loud. That is C3's target behaviour, already achieved once, in code.

## C1c — Orphan baseline, recorded before C3 changes anything

**Build artifacts: 0 orphans.** 44 `.js` / 44 `.d.ts` / 44 `.js.map`, exactly paired. G-025's named
files (`auto-feedback.d.ts`, `auto-feedback.js.map`) are gone. **Instrument checked before the zero
was trusted** — `build/` exists and holds 132 files; this is not a zero from a broken probe.

**But the mechanism is still absent, and the 0 is therefore not a property.** `package.json:12` is
`"build": "tsc"` — no `prebuild`, no clean, and `tsconfig.json` sets `outDir` with no `incremental`.
`tsc` does not remove stale output. **Today's 0 was swept by hand and the next cut restores the
debris.** G-025 is stale as written; the defect it points at is not.

**Unresolved path references in the five unswept areas** — screening counts, not defect counts:

| area | unambiguous path refs | unresolved | |
|---|---|---|---|
| `project-template/` | 78 | **21** | in scope |
| `open-brain/docs/` | 7 | **2** | in scope |
| test fixtures | 61 | **26** | in scope, but see C1.3 |
| `.agents/SESSIONS/` | 399 | 144 | historical — excluded by rule |
| `.agents/archive/` | 442 | 174 | historical — excluded by rule |
| **in-scope total** | **146** | **49** | |

**These are screening numbers and must not be reported as defects.** Two rounds of resolver error,
both caught by reading the filesystem rather than trusting the count:

1. First pass said 173/298 unresolved in `project-template/`. It counted bare filenames, which are
   ambiguous by construction. Excluded → 28.
2. Second pass still flagged all five `.claude/rules/*.md`. **All five exist.** The resolver did not
   try the area root. Fixed → 21. `META/SUMMARY.md` remains flagged and is also correct-as-written:
   `FRAMEWORK.md:520` *instructs the reader to create it.*

**A path check that does not know the difference between a path that should resolve and a path being
prescribed will report a 27% defect rate on a healthy directory.** That constraint goes into C2
before any check ships.

**Two genuine hits survive reading**, both root-prefix drift rather than dead files:
`shadow-recall-ranking-2026-09-14.md` → `scripts/shadow-backfill.mjs` (lives at
`open-brain/scripts/`), and `…-09-15.md` → `shadow/index.ts` (lives at `open-brain/src/pipelines/shadow/`).

## What C2 inherits

1. **Lead with file and command paths, not tool names** — 11 of 19 in the worked example.
2. **Three exclusions are mandatory before the first check ships**: historical paths, prescribed
   paths, frozen fixtures. Without them C2's first run reports ~49 findings of which most are noise.
3. **The retirement record keys on the event, not the ruling** — six classes, `CUT` is one.
4. **An allowed-citation form is not optional** — four live files would fail C3 for being correct.
5. **Fix `README.md` first**, and let it be the first thing the new check catches. **It must be seen
   to fail on that file before it is trusted** — rule 2, and this time there is a real defect to
   fail on rather than a scratch input.

**Nothing has been repaired at this boundary. Counts only, as instructed.**
