Save this as something like `HOH_JEV.md` (or drop it in `CLAUDE.md`) and point Claude Code at it.

```markdown
# HoH + Jev setup brief for Claude Code

Use this document to implement an outer Harness-of-Harness (HoH) loop around Claude Code, with TypeSafe Jev as the typed decision layer. Do not treat Jev as a coder. Do not merge planner and QA.

---

## Goal

Build a multi-iteration autonomous coding loop:

1. Planner writes a bounded increment plan `D_t`
2. Developer (Claude Code) implements it into artifact `A_t`
3. QA Tester independently evaluates frozen `A_t` and writes evidence `E_t`
4. Runtime stores versioned state and starts the next loop

Jev answers closed questions at the gates between those roles. Claude writes plans, code, tests, and reports. Deterministic code owns git, permissions, schema checks, test runners, and side effects.

---

## What Jev is

Jev (TypeSafe AI, Sept 2026) is a System One model. It does not chat and does not generate text.

Input:
- unstructured `state` (text/JSON)
- typed `questions`

Output, in one parallel pass:
- `choice` — pick from options you define + probabilities + confidence
- `score` — position on an ordered rubric + confidence
- `noul` — P(statement is true) in 0..1

Latency typically 70–500ms. Price listed at $0.042 / million input tokens, free output. Outputs cannot leave the schema you declared.

Training pitch: RLCD (Reinforcement Learning for Calibrated Decisions). Official skill:

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

API key: `TYPESAFE_API_KEY` from console.typesafe.ai  
Endpoint: `POST https://api.typesafe.ai/v1/systemone`  
Model alias: `jev-latest`

Do not use Jev to write code, emails, summaries, or explanations. Do not ask it to count, do date math, compare SHAs, or compute anything code can compute.

---

## What HoH is

Paper: *Harness-of-Harness: Multi-Day Autonomous Software Development with Continual Improvement* (arXiv:2609.01481).

HoH is an outer harness around an existing coding harness (here: Claude Code). Each iteration is:

```
Planner -> Developer -> QA Tester
```

Fixed inside a run: model, base harness, role prompts, runtime policy.  
Evolving: development document, software artifact, execution evidence.

States:
- `S` — high-level spec (fixed)
- `A_t` — artifact after loop t (code, assets, config)
- `D_t` — plan for loop t
- `E_t` — QA evidence for loop t

Transition:

```
(A_{t-1}, E_{t-1}) --loop t under S--> (A_t, E_t)
```

Design rules from the paper (enforce these):
- Each plan must repair outstanding problems AND add a small observable new capability.
- Scope increments so they are bounded but locally complete.
- Developer does shift-left local tests. Those do not count as acceptance.
- QA evaluates a frozen read-only candidate.
- Constrain deliverable schemas, not the agent's internal workflow.
- Persist artifacts on disk; expose a short index; load details on demand.
- Version by role and iteration so you can roll back regressions.

---

## Roles (do not collapse these)

### Planner
- Read-only on the repo
- Inputs: `S`, `E_{t-1}`, read-only `A_{t-1}`, artifact index
- Output: `D_t` (schema-checked)
- Must not edit product code
- Must not run QA

### Developer
- Write access, ideally limited to an allowlist derived from `D_t`
- Inputs: `A_{t-1}`, `S`, `D_t`
- Does implementation + local tests
- Output: candidate `A_t` (commit)
- Must not accept the product as done

### QA Tester — separate agent from the planner
- New Claude Code invocation
- Read-only checkout of the candidate commit
- May run the app, tests, linters, logs, screenshots
- Must not edit source
- Inputs: frozen `A_t`, `S`, `D_t`, runtime check results
- Output: `E_t` (schema-checked)
- Uses black-box (user-visible behavior) and white-box (source/config/logs)
- Missing evidence is a gap, not a pass

Why QA cannot be the planner:
- Planner is biased toward its own increment succeeding
- Planner context is contaminated with design intent
- QA must not silently repair the candidate
- Fresh context is required for independent acceptance

Same model is fine. Separate process, prompt, and permissions.

---

## Runtime (deterministic; you write this)

The runtime is the actual product you are building. Suggested layout:

```
repo/
  S.md                         # product spec
  harness/
    runtime.py                 # or ts — the outer loop
    jev_client.py
    schemas/
      plan.schema.json
      evidence.schema.json
    prompts/
      planner.md
      developer.md
      qa.md
    policies/
      gates.py                 # thresholds, no model calls here except Jev
  artifacts/
    index.md                   # short categorized index
    iterations/
      t001/
        D_t.md
        A_t.gitref
        E_t.json
        jev/
          plan_gate.json
          dev_gate.json
          qa_scores.json
  CLAUDE.md                    # points at this brief
```

Runtime responsibilities:
- freeze inputs per role
- enforce write permissions
- validate `D_t` and `E_t` against JSON/Markdown schemas; retry that role on violation
- run deterministic checks (build, unit tests, lint) before QA
- commit after developer and after storing evidence
- tag `loop-t-role` so rollback is a git operation
- call Jev at gates
- apply thresholds in code
- write the index, not a giant memory blob into every prompt

---

## Recommended loop

```text
for t in 1..T:
  1. Planner session writes D_t
  2. Jev plan-gate
     reject -> retry planner (cap N)
     stop_ship + requirements met in code -> halt
  3. Developer session implements D_t
  4. Runtime runs deterministic tests
  5. Jev developer-done-gate
     stuck / out of scope / high regression risk -> restore last good commit, skip QA or retry dev
  6. QA session on read-only A_t
  7. Jev scores E_t into typed fields
  8. Persist (A_t, E_t), update index
```

Optional inner Jev hooks inside the developer session:
- destructive command risk
- skill/tool routing
- “ask user vs proceed” only if a human is actually in the loop

For fully autonomous HoH, do not block on a user. Escalate to “stop this loop and record a blocker” instead.

---

## Jev question templates

Send small structured state. Batch many questions in one call. Combine answers in code.

### Plan gate (after planner)

State: spec excerpt, plan summary, prior failures, validated behaviors, changed-area hints.

```json
{
  "plan_mode": {
    "type": "choice",
    "instructions": "What kind of increment is this plan?",
    "criteria": {
      "repair_only": "Only fixes bugs; no new observable capability",
      "capability_increment": "Adds a small new observable capability with little repair",
      "mixed": "Fixes top failures and adds one bounded new capability",
      "stop_ship": "Claims the product already meets the spec and no increment is needed"
    }
  },
  "scope_size": {
    "type": "score",
    "instructions": "0 = too small to observe; 1 = one testable increment; 2 = unbounded rewrite"
  },
  "preserves_validated": {
    "type": "noul",
    "instructions": "The plan protects previously validated behaviors listed in state."
  },
  "addresses_top_failures": {
    "type": "noul",
    "instructions": "The plan targets the highest-severity unresolved items in prior evidence."
  },
  "has_observable_acceptance": {
    "type": "noul",
    "instructions": "The plan names concrete, observable acceptance checks, not just file lists."
  }
}
```

Suggested policy:
- reject if `plan_mode == repair_only` unless the spec is already feature-complete
- reject if `scope_size` is near 2 with high confidence
- reject if `has_observable_acceptance` < 0.7
- if `plan_mode == stop_ship`, only halt when deterministic tests + QA history support it

### Developer done-gate

State: plan summary, diffstat / changed files, test exit codes, last few commands, prior failure ids.

```json
{
  "diff_matches_plan": {
    "type": "noul",
    "instructions": "Changed files implement the plan's increment rather than unrelated work."
  },
  "touches_out_of_scope": {
    "type": "noul",
    "instructions": "The diff changes areas the plan did not authorize."
  },
  "local_tests_support_claim": {
    "type": "noul",
    "instructions": "Developer-reported tests and runtime exit codes support a handoff."
  },
  "stuck_repeating_prior_failure": {
    "type": "noul",
    "instructions": "This attempt repeats a previously recorded failed approach."
  },
  "risk_of_regression": {
    "type": "score",
    "instructions": "0 = validated behavior untouched; 2 = likely breakage of previously passing behavior"
  }
}
```

Suggested policy:
- hand off to QA if `diff_matches_plan` high, `touches_out_of_scope` low, tests green
- rollback if `stuck_repeating_prior_failure` high or `risk_of_regression` high and tests failed
- never ask Jev whether tests passed; read the exit codes

### QA scoring (after tester writes E_t)

State: spec checklist, plan acceptance items, tester observations, runtime check results.

One `choice` per requirement:
- `pass` / `fail` / `untested`

Plus:
- `severity` score for each fail
- `regression_of_validated` noul
- `artifact_complete_enough_to_stop` noul

Planner in loop t+1 should consume these typed fields first, then retrieve only the relevant report sections.

### Progressive disclosure

Index entries are candidates. Ask Jev `noul`: “Is this prior report relevant to the current plan?” Load only those files into the planner/QA prompt.

### Skill routing

Closed choice over the role’s allowed skills/MCP servers. Developer should not load planner skills and vice versa.

---

## Artifact schemas (minimum)

### `D_t` plan
```json
{
  "loop": 1,
  "objective": "one sentence observable increment",
  "tasks": ["small related tasks"],
  "out_of_scope": ["explicit exclusions"],
  "preserve": ["validated behaviors that must still pass"],
  "acceptance": [
    {"id": "A1", "observable": "what a tester can see or run", "type": "blackbox|whitebox"}
  ],
  "repair_targets": ["ids from E_{t-1}"],
  "new_capability": "the new thing this loop adds"
}
```

Reject plans with empty `new_capability` unless `stop_ship` is explicitly requested and justified.

### `E_t` evidence
```json
{
  "loop": 1,
  "candidate_git": "sha",
  "runtime_checks": {"build": "pass|fail", "unit": "pass|fail"},
  "requirements": [
    {"id": "R1", "status": "pass|fail|untested", "evidence": "path or log excerpt", "severity": 0}
  ],
  "acceptance": [
    {"id": "A1", "status": "pass|fail|untested", "evidence": "..."}
  ],
  "regressions": ["validated behavior that broke"],
  "gaps": ["things not evidenced"],
  "notes": "short; optional"
}
```

### Index entry
```markdown
- t001 planner: objective ...
- t001 dev: sha ... tests ...
- t001 qa: N fail, M untested, top gap ...
```

---

## Claude Code wiring

### Official TypeSafe skill (for writing Jev calls)
```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
export TYPESAFE_API_KEY=...
```

Invoke `/typesafe:typesafe-ai` when implementing the Jev client and question design.

### Role sessions
Use separate `claude` CLI runs or equivalent, each with a role prompt and a permission mode.

Planner / QA: no write tools to product source. Allow read, bash for tests (QA only), and writing only into `artifacts/iterations/tXXX/`.

Developer: write tools enabled. Prefer a worktree.

Example sketch:

```bash
# planner
claude -p "$(cat harness/prompts/planner.md)" \
  --permission-mode plan

# developer
claude -p "$(cat harness/prompts/developer.md)"

# qa — different cwd or worktree, read-only product tree
claude -p "$(cat harness/prompts/qa.md)" \
  --permission-mode plan
```

Adapt flags to the installed Claude Code version. The important part is process isolation and write isolation, not the exact flag names.

Optional community plugins (not required for HoH):
- `HyunjunJeon/jev-judgment` — pre-command risk gates inside a coding session
- `tamaratran/fast-jev-compaction` — keep/drop old tool results; experimental; can hurt prompt cache

Do not rely on compaction plugins as HoH memory. Use the file-system index instead.

---

## Role prompt skeletons

### Planner
You are the HoH Project Planner. You cannot edit product code. Read `S.md`, `artifacts/index.md`, and only the evidence files the runtime attached. Write `D_t` that:
1. addresses the highest-severity unresolved failures
2. adds exactly one small observable new capability
3. lists behaviors to preserve
4. lists black-box and white-box acceptance checks

Do not implement. Do not declare the product complete unless every spec item is evidenced as pass in `E_{t-1}` and runtime checks are green.

### Developer
You are the HoH Developer. Implement only `D_t`. Establish a baseline test, change, retest. Do not expand scope. When local tests for the increment pass, stop and leave a commit message referencing loop t. Do not rewrite the plan. Do not run product-level acceptance in place of QA.

### QA
You are the HoH QA Tester. The candidate is frozen. You must not edit product source. Derive checks from `S` and `D_t`. Run black-box and white-box observations. Record pass/fail/untested with evidence paths. Treat missing evidence as untested. Write `E_t` and stop.

---

## First implementation slice

Build in this order:

1. Runtime loop that can spawn three dummy role sessions and store files
2. Schemas + retry on invalid `D_t` / `E_t`
3. Git versioning per loop
4. Jev client + plan gate only
5. Developer done-gate
6. Real Claude Code role prompts
7. QA scoring through Jev
8. Index + selective retrieval

Do not start with compaction, trading bots, computer-use, or a single “is it done?” Jev question.

---

## What Claude Code should do when given this file

1. Inspect the current repo.
2. Create `harness/` and `artifacts/` as above if missing.
3. Implement a Jev client with redaction of secrets and failure-open or failure-closed made explicit in code (prefer fail-closed on destructive actions, fail-open only on optional ranking).
4. Implement the outer loop with three isolated roles.
5. Put planner and QA in separate invocations.
6. Add the plan-gate and developer-done-gate first.
7. Write a dry-run mode that prints Jev payloads without sending them.
8. Do not invent Jev output text. Parse typed answers only.

When asked to extend the product being built, stay inside `D_t`. When asked to improve the harness, change `harness/` and say so.
```

That file is the whole working agreement: HoH supplies the three-role loop, Jev supplies the gates, Claude Code is the inner coder, and QA stays a separate agent.