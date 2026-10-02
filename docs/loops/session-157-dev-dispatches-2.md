# Session 157 dev dispatch 2: sia-builder takes T-183 (the ruled cut), T-224 and T-223

**By:** Atlas (planner), record session 157, 2026-10-02. **Job class: LIGHT.** Run only the touched tests and
`tsc --noEmit`. Any HEAVY step needs a slot from clark.

Use three branches, one PR each. Opening those PRs is the only PR action authorised. **Do not merge.**

## 1. T-183, the cut ruled by D-100: `loop/t183-render-cut`, stacked on `6c495794` (T-209/T-210, in QA 253)

Stacking is allowed because QA does not block it. If QA 253 rejects T-209, this branch is rebased onto round 2.

- **Gaps:** render the **newest 10 open gaps**, in T-209's order, then one count line:
  `… and N older open gaps (M open in all): state.json gaps[]`. The count comes from `gaps[]`, not from the
  rendered lines.
- **Tasks:** clip each task title at **100 characters**, ending a clipped title with `…`. Ids and statuses are never
  clipped.
- **Role files: NO change.** The shared.md pointer was refused in D-100.

Rows:

1. **Exactly 10 gaps render**, and the count line states the real totals. Use a fixture with 40 open gaps.
2. **A record with 10 or fewer open gaps** has no count line.
3. **A 250-character task title** renders as 100 characters with `…`, and its id is intact.
4. **Measure the live render at the head**, with the same method as your T-183 table, and report the new total.
5. **A mutant that counts the rendered lines** instead of `gaps[]` goes red.

## 2. T-224: `loop/t224-placeholder-reason`, from `origin/master`

When `readStatusKeys` meets a value that is an unfilled `<placeholder>`, the reason names it:
`status_to is an unfilled placeholder (<agent-name>)`. It no longer says "missing".

- Keep the rule that a placeholder counts as unset.
- If the template's sentence about filling values sits next to the example, make it say to replace the `<…>` values.
- Rows:
  1. Copying the template's example verbatim gives the placeholder reason. Read the template file at test time, as
     SR-7 does.
  2. A genuinely absent key still says "missing".

## 3. T-223: `loop/t223-pin-pr-group`, from `origin/master`

In `ci-runs-on.test.ts`, assert the exact PR group string `ci-pull_request-<branch>`. Add a collision case: a PR from
head `push-x` is not in the same group as a push to `x`.

- **Red-first evidence:** QA 250's M-push-only mutant
  (`format('ci-{0}{1}', github.event_name == 'push' && 'push-' || '', …)`) now fails a row.
- **Do not change `ci.yml`.**

## Handoff

Write one handoff, `docs/loops/session-157-builder-2-handoff.md`, on the T-183 branch. It gives each branch's SHA and
its red and green output. Report to `atlas-sia`, or to `clark` if it is unreachable.
