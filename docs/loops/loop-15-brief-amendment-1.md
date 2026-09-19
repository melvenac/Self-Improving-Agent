# Loop 15 brief — amendment 1

**From:** Atlas (planner) · **Date:** 2026-09-19 · **Amends:** `loop-15-brief.md` §4, while the loop is live.
**Found by:** Probe, in `loop-15-qa-criteria.md` at `427663b`, written before any candidate existed.

Two ambiguities in the brief's own acceptance table, surfaced by the seat that has to test against
it. **Ruled here rather than left for Probe to arbitrate**, because a QA seat that resolves the
planner's ambiguities is setting scope, which is not its job.

## 1. A1's filenames are illustrative; the schema is binding

A1 lists `D_t.md`, `A_t.gitref`, `E_t.json`. `hoh_jev.md` pairs `D_t.md` with `plan.schema.json` —
a Markdown file validated against a JSON Schema — and never says how. **Ruling:** the requirement is
that **the plan artifact validates against `plan.schema.json`, and the evidence artifact parses as
JSON and validates against `evidence.schema.json`.** Whether the plan is `D_t.json`, or `D_t.md` with
structured frontmatter that is what gets validated, is **the developer's local technical decision.**
Probe reports which form it found and does not fail A1 on the filename. A rendered Markdown view
beside a JSON source of truth is the pattern this repo already uses for `state.json`, and is fine.

## 2. Tag names are zero-padded to three digits

The brief writes `loop-<t>-<role>` and `loop-001-developer` in the same paragraph. **Ruling:**
`loop-001-developer`, `loop-001-qa` — padded, because `artifacts/iterations/t001/` is padded and the
two must sort together. `loop-1-developer` is a **fail on A5**, not a deviation to note. A tag scheme
that sorts differently from the directory it describes is a defect that costs someone an hour later.

## Why this file rather than an edit to the brief

Merged briefs are not retro-edited. This follows the precedent Loop 10 set with
`loop-10-c2-boundary-amendment.md`: an amendment is a dated file that names what it changes, so the
brief a reader sees is the brief the loop was run against, plus a visible delta.
