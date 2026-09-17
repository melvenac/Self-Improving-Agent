# Loop 12 — C3 boundary report: the record a deletion is checked against

**Commits:** `5eb6125` (mechanism + record, **red**) → `cbf61ac` (repair, green).
**Tests:** 603. **`sync --check`:** 24 passed, 0 issues, 3 pre-existing warnings.

---

## The thesis, carried forward from C2

**A referent is checkable only where a registry exists, and the filesystem is not one** — a registry
is a closed list of what exists *and may be named*, and the filesystem answers only the first half.

**For a retired name there is no registry anywhere, because the thing is gone.** So the record *is*
the missing registry, built by hand at the one moment anyone can build it. That is what C3 is. It is
not a linter.

## The record already existed, in prose, and it changed nothing

`.agents/LIFECYCLE.md` has a **Component Log**. It is tracked. It has been correct since April:

```
2026-04-16 | /recall | PRUNED | Absorbed into /start — command file already removed
```

**The `/recall` reference in the gotchas skill survived to v0.36.0 anyway.** Five months,
thirty-four minor versions, eleven loops, and an audit of 77 instruction files *looking for exactly
that class of defect*. It survived because **nothing read the log.**

**That is Loop 11's rule 4 in one artifact** — every containment that worked was a command, every
containment that failed was an intention — and it is the entire argument for this half of the loop.
The log was right, tracked, and inert. `.agents/retirements.json` is the same record as data, and
`/sync` reads it on every run.

**It also carries the one thing a prose log never could: `allowed_referrers`, captured at retirement
time.** That set cannot be derived afterwards, because a retired name in prose is textually
identical whether it is a defect or an obituary — C2 demonstrated that by firing on its own repair.

## What the backfill found: `dream` is worse than `/skill-scan` was

Loop 10 deleted `open-brain/src/pipelines/dream/` outright. Left behind, live at `ae1988d`:

- **`README.md` — a 32-line documented section** with three runnable command lines a reader would
  have typed, and three paragraphs describing the behaviour of deleted code.
- **`cli.ts`'s own usage block**, still advertising `dream [--since=<days>] [--json]`.

**The CLI's help is the closest thing a subcommand has to a registry — and it was lying.** It is a
hand-maintained list sitting beside the dispatch rather than derived from it, which is precisely the
"second list" that `command-tool-names`' own comment warns about. Running `dream` prints the usage
that advertises `dream`. It does exit 1 rather than 0 — **checked, not assumed.**

`cli-session-end.ts`'s file header was the third: *"(summary, feedback, reflection, invocation
logging, skill-scan)"*, two cut components, the same defect as README:121/:167 from C2 but in source.
**The front-door claim and the module's own header were wrong in the same way and neither review
caught the other.**

## Design, and why each part was forced rather than chosen

**Entries are global, not per referent class.** A per-class record would have *no entry at all* for a
class with no registry, so it would under-cover **silently**. Global keeps the record complete where
checking cannot follow and moves the incompleteness into the output, where the pass message names
the classes it cannot resolve and says plainly: **green means every RECORDED retirement is finished,
never that every retirement is recorded.**

**An empty record is an issue, not a pass.** An empty record passing is the same defect as a check
nobody has seen fail. The retirement count and the verified-referrer count travel in every message,
and a stale allowlist entry — a path deleted, or one that no longer names its retirement — fails
rather than rotting quietly.

**Case sensitivity is per retirement and defaults to strict.** Granting `i` globally made `KB_PATH`,
a live variable in `dashboard.mjs`, match the retired `kb_*` **tool** prefix. **Rule 8 arriving
inside the check written to enforce it.** Pinned by a test.

## Declined, and the decline is a finding

**`success_rate`, the maturity lifecycle and `apoptosis` are NOT in the record.** Loop 10 is recorded
as cutting all three. `open-brain/src/lifecycle.ts` is still present, still exports
`LIFECYCLE_CONFIG`, `Maturity` and `Rating`, and is imported by `db-v2.ts`, `server.ts`,
`shadow/evaluate.ts` and `shadow/strategies.ts`.

**The behaviour was cut; the type, the vocabulary and the column were not.** Recording them as
finished would make the check green on an unfinished retirement — the exact failure the record exists
to prevent, and the one the Planner named: *green would read as "it is done."* Held in `$declined`
**for Aaron**, not asserted either way.

## The build prunes

`package.json` gains a `prebuild` that removes `build/` before `tsc`. **`tsc` never deletes stale
output**, so G-025's class was structurally guaranteed to recur after every cut.

**Demonstrated, not asserted** — rule 9: planted `auto-feedback.d.ts` and `auto-feedback.js.map`, the
exact files G-025 names, then ran the build. **Orphan count 2 → 0.**

This is the Planner's design principle in its strongest available form: *prefer making a missed copy
fail over reporting that it exists.* **`project.version` is the precedent** — a file still carrying it
does not parse, so the missed copy is loud in code with no check involved. Where the referent is
code, delete it so the compiler complains; where the referent is a build artifact, make the build
remove it.

**AMENDED AFTER R-010 TESTED IT.** That ordering was asserted from intuition and the evidence does
not support it. Cutting `enableHeuristicRatings` produced this:

| instrument | caught | cannot see |
|---|---|---|
| **compiler** | **nothing** | `tsconfig.json` is `"include": ["src/**/*"]` — there is one tsconfig and **`tsc` never reads the test directory at all** |
| **test suite** | **6 referrers**, two files, at runtime *after* `tsc` was green | prose |
| **`retirements` check** | **1** — `README.md`, describing the flag as a live gate | code that compiles |

**"Delete it so the compiler complains" is not merely bounded — it is blind to the half of the
codebase most likely to name a thing nobody uses any more.** The corrected claim: **the compiler is
strongest over what it compiles, the suite reaches past it into code the compiler ignores, and the
check is the only one that reaches prose. All three were necessary, and none is a substitute for
another.**

## Coverage, stated rather than implied

```
8 retirements across 4 event classes, 39 allowed referrers all present and still
naming their retirement, 0 unexpected across 152 live files —
resolvable against a registry: command, tool;
guarded by this record alone: cli-subcommand, package, path, prose, schema-field, symbol
(green means every RECORDED retirement is finished, not that every retirement is recorded)
```

**Six of eight referent classes are guarded by the record alone.** That is the honest coverage, and
it is in the check's own output rather than in this document, because a reader who sees green three
months from now will not be reading this document.

## Reported, not repaired

- **One intermittent full-suite failure**, passing on re-run. **G-016 is open on exactly that** and
  nothing here touches it. Recorded rather than quietly re-run until green.
- `open-brain/package-lock.json` remains stale against `package.json` (C2's finding, unchanged).
- `sync.md`'s `docs/PRD.md` in three mirrors — the one real path finding from C2. **Still open:** it
  is a path, the class with no registry, and the retirement record does not cover it because nothing
  was *retired* — the file simply lives elsewhere. **A wrong path is not a retirement, and this loop
  should not pretend its mechanism reaches it.**
