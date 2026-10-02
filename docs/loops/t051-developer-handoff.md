# T-051: a /sync check for the skills contract, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t051-skills-contract` from `origin/master`. **Dispatch:** atlas-sia, session 157 (LIGHT). Not merged; one PR.

## The note against today's tree

T-051's directory work was done on 2026-08-11 and the tree still shows it: `.agents/skills/` has exactly two directories (`self-improving-agent-gotchas`, `self-improving-agent-guide`), each with frontmatter whose `name` equals its directory, and `INDEX.md` has two rows whose Skill and Directory cells name them. The note's remaining scope was the validator itself, which is this PR. `seo-optimizer-test/` is not in the tree (archived, as the note says).

## What it is

`checkSkillsContract(projectRoot)` in `open-brain/src/pipelines/sync/checks.ts`, registered in `sync/index.ts` after `skill-index` as `skills-contract`. It is separate from `checkSkillIndex`, which validates the vault's `SKILL-INDEX.md` (a different file with a different shape).

For each directory under `.agents/skills/`, and each row of `INDEX.md`, it compares the three identities. One finding per disagreement, each naming all three sources: `directory <d|absent>; SKILL.md name <"x"|none (no SKILL.md / no frontmatter / frontmatter has no name)>; INDEX.md <row "S" -> D/ | no row>`. Findings: no SKILL.md; no frontmatter; no `name`; name not equal to the directory; a directory with no INDEX row; an INDEX row whose Skill cell is not the directory name; an INDEX row whose directory does not exist; skills present but no readable `INDEX.md`. Severity is **issue**. No `.agents/skills/` at all is **skip** (`not checked ... This is not a pass.`).

## Rows (`tests/pipelines/sync/skills-contract.test.ts`, 9 tests)

baseline pass; 1 missing frontmatter; 2 name/dir mismatch (the `gotchas` case: both the directory and the orphaned INDEX row are reported); 3 INDEX row with no directory; 4 directory with no INDEX row; plus no SKILL.md and no `name`, a Skill cell that is not the directory, no INDEX.md, no skills directory (skip), and **the real tree** (passes).

## Evidence

- **Red** (the file against `origin/master`'s source): 9 failed, all `checkSkillsContract is not a function`. **Green:** 9 passed. `tsc --noEmit` 0; `tests/pipelines/sync` all pass.
- **Mutant** `docs/loops/t051/mutants/skip-no-frontmatter.diff` (a SKILL.md without frontmatter is skipped instead of reported): `tsc --noEmit` 0; **red on row 1 only** (1 failed, 8 passed).
- **Live tree**, called directly: `{ "severity": "pass", "message": "2 skill(s): directory, SKILL.md name and INDEX.md row agree for each" }`. Not run: the full suite, a real `/sync` report with the line in it.

## Scope notes

- `project-template/.agents/skills/` is not checked (not asked); the check takes the checkout's `.agents/skills`.
- INDEX rows are read from any table whose first header cell is `Skill`; the Directory cell has its backticks and trailing slash stripped. A different INDEX layout would read as rows with empty directories and be reported, not passed.
