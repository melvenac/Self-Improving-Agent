# Records 214 and 215: the planner seat hook (T-194) and D_t + the plan gate for interactive briefs (T-195)

**Planner session 149, 2026-09-28. Record rev 149.**

## Authority

Aaron's words, relayed to the planner by a general Claude session (`worktrees-d5`, "Clark") on 2026-09-28
and recorded verbatim in T-194's note:

> "tell Atlas to go ahead with its steps (a) to (h), with (g), the record update, moved to the front, add
> the two new tasks: the planner seat hook, and the D_t file plus plan gate for interactive briefs. This
> needs to be done now sice it's causing issues running the loops."

The provenance has two links: Aaron to `worktrees-d5`, then `worktrees-d5` to Atlas. The relay covers
opening, prioritising and dispatching these two tasks. **It is not Aaron's word on any merge.** Both
candidates go to QA and then to Aaron, as every code change does (D-032).

## Where these sit (planner ruling, session 149)

Neither task is part of slice three. **D-036 is not amended:** slice three still closes at A, B and C.
Both tasks run now, alongside it, because Aaron ruled that they are hurting the loops today. T-195's
gate decisions on real briefs will be the first real data the Jev calibration slice (D-033) needs. If
QA 213 rejects candidate C r3, **C r4 takes precedence on Forge** over record 215.

## Common to both

- **Base:** `origin/master` `8467cb1`. All facts below were read at that commit, not from a stale
  seat tree.
- **D-061:** developers run no CI of any kind. Quote each local run's failing lines and exit codes.
  **Master and PR CI run no tests until #200 merges**, so a green check on your PR proves nothing yet.
- Mutants go on their own branches, and each passes `tsc --noEmit` before it counts.
- Assert inputs from a fixture environment, never from inherited `process.env` (G-044).
- **Hold every push while a QA run is active.** The old driver template charges another seat's
  mid-run push to the QA seat. The planner posts when the machines are clear.
- Write a handoff at the named path. It maps each acceptance row to the test that asserts it, with red
  (against master or the mutant) and then green.

---

## Record 214, `cursor-builder` (Grok 4.7): T-194, the planner seat hook

**Problem.** The planner's write boundary is prose only (`.agents/roles/planner.md`, "Authority, stated
as a boundary"). `sia-planner/.claude/settings.local.json` has no `hooks` key. A boundary an agent is
asked to respect is probabilistic, while a hook that refuses is not (CLAUDE.md, "Deterministic
First").

**Suggested shape (accept it or beat it):** a PreToolUse hook script, tracked in the repo, keyed on the
`role` in the checkout's `.agents/AGENT.local.md` frontmatter, and registered per checkout. The
mechanism is local and the knowledge is tracked. It must be deterministic, with no Jev.
`open-brain/src/cli-recall-trigger.ts` is this repo's existing tool-use hook, and the precedent for
build, install and Windows behaviour.

**Registration is Aaron's hand, not the planner's.** Adding the hook to `sia-planner`'s
`settings.local.json` changes the planner session's own permissions. Ship the snippet, or a command
that prints it, and the planner will put it to Aaron.

**Acceptance.** Each row is red without the hook, or against a mutant, and green with it.

| Row | Observable |
| --- | --- |
| **PH-1** | An `Edit`, `Write` or `NotebookEdit` whose target is source, tests, hooks, scripts, build output or `package.json` is **denied**. The refusal names the rule (planner.md, "Authority") and the path. |
| **PH-2** | A direct `Edit` or `Write` to a rendered view (`.agents/TASKS/INBOX.md`, `.agents/TASKS/task.md`, `.agents/SESSIONS/next-session.md`), or to `.agents/state.json`, is **denied**, and the refusal names the rule ("state changes go through `ob_state`"). For `SUMMARY.md`, an edit that touches the marked region is denied and an edit outside it passes, each shown by a row. |
| **PH-3** | A Bash `git merge`, `git tag`, `git push --tags`, a force push, a push to `master`, and `gh pr merge` are **denied** unless a per-occasion grant exists. The refusal names the rule: shared.md, "Each outward-facing act needs authority for THAT act", and D-038 / D-032. **You design the grant.** It must be something the planner session cannot create through its own `Edit`/`Write` (PH-1 covers its path), and it is consumed or expires after one use. |
| **PH-4** | **Allowed acts still pass:** a `Write` under `docs/loops/`, any `Read`, `git status`/`log`/`fetch`/`diff`, and `git push origin docs/<branch>` to the planner's own working branch (standing under D-038). A D-032/D-055 docs-only merge must not be made impossible: either the hook verifies the allowlist itself, or it routes through the PH-3 grant. Say which. |
| **PH-5** | **Fails closed:** malformed hook input, a missing or unparseable `AGENT.local.md`, or an unknown `role` value is **denied**, and the refusal says why. A readable `role` other than `planner` passes through, because this hook enforces the planner seat only. |
| **PH-6** | Bash commands that write into PH-1/PH-2 paths (redirects, `sed -i`, `tee`, `cp`, `mv`) are denied **where statically detectable**. The hook states its limit in its own output and in the handoff: it stops mistakes by the planner's tools; it is not a sandbox. |
| **PH-7** | The hook parses its input as JSON and never pattern-matches over the JSON text (shared.md, "The instrument for structured data is a parser"). Include a mutant per row, including one that turns a deny into an allow. |
| **PH-8** | It works on Windows under Claude Code, and a deny still wins when the context-mode plugin's own PreToolUse hook runs too. Test what can be tested. Name the rest as the live check below. |

**The live check (planner, after Aaron registers it):** in a live planner session, one denied `Edit`
to `open-brain/src/` and one allowed `Write` under `docs/loops/`. The refusal text is quoted in the
ruling. A config check is not a live run (#199).

**Branch** `loop/t194-planner-hook`. **Handoff** `docs/loops/t194-developer-handoff.md`.

---

## Record 215, Forge (Grok 4.7, `sia-forge`): T-195, a D_t beside every brief, judged by the plan gate

**Problem.** `docs/loops` holds prose briefs and **zero** D_t JSON. The plan gate was ACCEPTED in slice
two (HOH-JEV.md §7). `gate.ts` builds the Jev request and records `resolvedModel` (lines 178 and 511 to
527 at `8467cb1`), and thresholds live in `policies/plan-gate.json`. The gate is wired only into the
runtime's own planner stage (`runtime.ts` calls `validatePlan` on a staged deliverable). **It has
never judged a plan a real planner wrote.** QA's output carries `E_t`; the planner's carries nothing
equivalent. `harness validate evidence <file>` exists (BE-7, `cli.ts:31`); **`validate plan` does
not.**

**Acceptance.**

| Row | Observable |
| --- | --- |
| **DT-1** | `harness validate plan <file>` calls `validatePlan` against `plan.schema.json`. It exits 0 when valid, exits 1 printing **every** problem with its field path when invalid, and exits 2 on a usage error, mirroring `validate evidence`. |
| **DT-2** | A command runs the **plan gate** on a D_t file. The payload follows HOH-JEV §4 "Plan gate": spec excerpt, plan summary, prior failures, validated behaviours, changed-area hints. Each field comes from a **named** source, such as `state.json` `gaps[]`/`verified[]` or the D_t itself, and the decision record prints the source of each. |
| **DT-3** | Thresholds come from `policies/plan-gate.json` only. A mutant that inlines a threshold, or ignores the file, is caught. |
| **DT-4** | Each gate run writes a **decision record** beside the brief: the verdict, the answer and confidence per question, the thresholds applied (with the policy file's hash), the **resolved model** (HOH-JEV §3), and the time. Records are never overwritten. A second run adds a second record. |
| **DT-5** | **A failure is fed back in a form the planner can act on:** each failing question with its value and the threshold it missed (e.g. `has_observable_acceptance 0.55 < 0.7`). |
| **DT-6** | **Fails closed:** a missing `TYPESAFE_API_KEY`, a network error, a non-2xx response or a malformed envelope each produce a refusal that names the cause and exits nonzero. **Never a pass.** Each is shown against a stub, with no live key in tests (G-044). |
| **DT-7** | **Blocks dispatch.** A brief without a valid D_t and a passing decision record cannot be dispatched. Name the mechanism and show it refusing. One constraint rules out the obvious choice: CI skips docs-only pushes (D-055, T-178), so CI alone cannot be the gate. |
| **DT-8** | **Preserved:** the runtime's existing plan-gate path, `validate evidence`, the done-gate and both policy files are unchanged. Their existing tests pass unchanged. |

**Named limit.** The first live Jev call on a real brief is observed after merge, by the planner with
Aaron's key, on the next brief the planner writes. That brief's D_t and decision record are the live
proof. Until then, the tests prove the plumbing and not Jev's answers.

**Branch** `loop/t195-dt-plan-gate`. **Handoff** `docs/loops/t195-developer-handoff.md`.
