# Research 1: `jkudish/jev-mcp`, and what it means for SIA's use of Jev

**By:** Scout (`sia-research`, `role: none`), 2026-09-26. **Model:** Claude Opus 5.5 (1M context). **Effort:** as
configured for this session; not independently measured.
**Brief:** `docs/loops/research-brief-jev-mcp.md` on `origin/docs/session-100-qa99-dispatch`, from Atlas at Aaron's request.
**Source read:** `github.com/jkudish/jev-mcp` at **`108d61e`** (2026-09-26 00:01Z, v0.9.0), cloned to
`~/Third-Party/jev-mcp`. **It was read only:** no install, no build, no run, no MCP registration, no Jev call and no key.

**Labels.** **READ** means I opened the source myself: the repo's code, SIA's code, the GitHub or npm API, or a
`docs.typesafe.ai` page. **TOLD** means a source is making a claim that I could not check, such as the README's own
performance numbers. **INFERENCE** marks my own reasoning.

---

## 0. The answer in three sentences

**Don't use jev-mcp in SIA's loop. Keep the plain API through SIA's own `harness/gate.ts`.** An MCP server puts the
decision to call Jev in the *agent's* hands. Every SIA use named in the brief needs *code* to call Jev at a fixed point
and record the answer, which is the deterministic-first shape. jev-mcp is still worth mining as a **reference**: its
question designs, its fail-closed validation, and its reading of `confidence` should inform the calibration slice.
**What would change my mind:** a use where an *agent* should choose, mid-task, to ask for a judgment, and where the
answer is logged, not acted on. §5 names one.

---

## 1. What the repo is

| Fact | Value | Label |
|---|---|---|
| Owner | `jkudish` (Joey Kudish), a GitHub **user**, not an organisation | READ (GitHub API `owner.type: User`) |
| Official TypeSafe? | **No. Third party.** The `typesafe-ai` org's repos are `typesafe-sdk-js`, `typesafe-sdk-python`, `skills`, `system-one-adapter-python`, and others. None is an MCP server. | READ (GitHub API, org repo list) |
| Licence | MIT | READ (`LICENSE`, `package.json`) |
| Age / activity | Created 2026-09-17; 54 commits; last push 2026-09-26 00:01Z; 9 npm versions in 9 days | READ (git log, GitHub/npm APIs) |
| Popularity | 363 stars, 39 forks, ~5,780 npm downloads in the last week | READ (GitHub API, npm downloads API) |
| Maintenance | Active. 37 issues/PRs; outside contributors (oppih, deadczarvc, rimusz, Garfielk) filed real defects (fail-open on malformed answers, #9; silently stripped args, #19; argmax not enforced, #10), and all were fixed. **One maintainer** on npm. | READ (issues API, npm maintainers) |
| Self-description | "This is early software. Expect rough edges." | READ (README) |
| Runtime | Node ≥ 22, a stdio MCP server (`bin: dist/index.js`) | READ (`package.json`, `src/index.ts:1707`) |
| Dependencies | `@modelcontextprotocol/sdk`, `zod` 4, `@typesafe-ai/sdk` 0.6.0 (**official**, maintainers `alliesafe`, `diogo149`), and **`@jkudish/jev-agent-tools` 0.1.3**, the same author's wire package (created 2026-09-23, 1 star) | READ (`package.json`, lockfile, npm registry) |

### The eleven tools (READ, `src/index.ts` and README)

Each tool builds TypeSafe questions from typed MCP arguments (zod `.strict()`; unknown keys are rejected), sends **one
batched request**, validates the answers, and maps them to a verdict **in code**:

| Tool | Jev primitive(s) | Returns |
|---|---|---|
| `jev_verify` | Choice supports/contradicts/says_nothing per claim | verdict, distribution, confidence, auto/review |
| `jev_screen` | Nouls (injection, substance, relevance) | pass/review/block/skip |
| `jev_noul` | Noul per proposition (≤64) | probability, likely/unlikely/uncertain |
| `jev_find` / `jev_rerank` | Choice over ids + exists Noul / one Noul per candidate | ranked candidates |
| `jev_classify` | one Choice per item (≤64 items, ≤250 classes) | class, margin, auto/review |
| `jev_decide` | Choice + requirement checks, with ask_user/investigate/none escape hatches | recommendation or escape |
| `jev_compare` | Choice same_fact/contradicts/different_facts, optionally per aspect | relation |
| `jev_extract` | a regex (run in a worker with a 1 s deadline) finds candidates; a Choice picks one | verbatim value |
| `jev_review` | 4 Score rubrics (0..2) + a safe-to-apply Noul → a weighted composite | auto/review/escalate + reason codes |
| `jev_gate` | `jev_review` + one Choice per completion claim, judged from evidence only | worst action wins |

**Endpoint and auth (READ, `src/provider.ts`).** The default is TypeSafe direct (`TYPESAFE_API_KEY`), through
`@jkudish/jev-agent-tools`, which the README says uses a direct fetch path to avoid an SDK cancellation crash
(`typesafe-sdk-js#2`; TOLD, I did not open that issue). It also supports OpenRouter (`/alpha/decisions`), Cloudflare
Workers AI, the Vercel AI Gateway, and any "compatible" endpoint. **When more than one key is present, the provider is
chosen automatically from environment variables.** The key comes from `process.env` only.

## 2. Soundness and safety

**What it sends where (READ).** Only to the configured provider. `provider.ts` has four `fetch` sites, one per
transport, and the typesafe/vercel path goes through the wire package. `SECURITY.md` says it "does not execute browser
actions, read files, or make other network calls" (TOLD by the repo). A `grep` of `src/` for
`writeFile|appendFile|fs.|child_process|spawn|exec(` found nothing (READ). **Caveat:** I grepped the source, which
cannot rule out behaviour inside `@jkudish/jev-agent-tools`, and that package's source I did **not** read.

**Logging (READ).** One `console.error` line at startup, `ready — model <MODEL>`, goes to stderr. Prompts and answers
are not logged. **Keys** are redacted from error bodies before they become MCP-visible text, on the OpenRouter,
Cloudflare and compatible paths (`redactSecret`, `provider.ts:24`). The error text for the typesafe/vercel path comes
from the wire package, which I did not read.

**Install scripts (READ).** None. npm registry metadata for `0.9.0` has no `preinstall`/`install`/`postinstall`, and
the lockfile has no `hasInstallScript`. **`prepare: npm run build`** does exist. npm runs `prepare` for a git or local
install, not for the published tarball, so `npx -y @jkudish/jev-mcp` does not trigger it (INFERENCE from npm's lifecycle
rules, not tested). The same holds for `jev-agent-tools` 0.1.3 and `@typesafe-ai/sdk` 0.6.0. The repo's `.agents/setup`
is an Amp orb script (`npm ci && npm run build`). It runs only if something invokes it.

**Does its surface match TypeSafe's documented API? Yes (READ).** It uses `POST https://api.typesafe.ai/v1/systemone`,
the `{model, state, questions}` body, Bearer auth, and the Choice/Score/Noul primitives. All of these match
`docs.typesafe.ai/api.md` and `models.md` as I fetched them today, and they match what SIA's `gate.ts` already confirmed on
2026-09-20. **The only undocumented surface is the OpenRouter `/alpha/decisions` endpoint** (the code comment says so:
"The decisions endpoint does not document a usage block"), and it is not the default.

**Quality signals (READ).** Fail-closed choices run throughout. A malformed answer is `invalid_response` and never a
default. Unknown confidence "can never satisfy a threshold, even a zero one" (`lib.ts:382`). Truncated input can never
return `auto` (`requireCompleteContext`). Retries happen only on 408/409/429/5xx, never on ambiguous network failures ("a
re-send can double-process a paid call"). There is a whole-request deadline and a streamed 1 MB response ceiling. Most
of these came from outside defect reports, so the code has been read adversarially by someone. That is good evidence of
care, not proof of correctness. There are 150 `it`/`test` cases across 5 files, 20 of them live e2e cases gated on a CI
secret (READ, counted by grep; **not run**).

**Two soundness findings that matter to SIA.**

1. **`confidence` is not the probability of being right (READ, both sides).** The README says it "measures how peaked
   the option probabilities are... it is not the probability the answer is correct, so tune thresholds against observed
   outcomes." TypeSafe's `confidence.md` computes it as `(k·max_p − 1)/(k − 1)`. Issue #29 says the same. **The
   thresholds jev-mcp ships** (`auto_accept 0.8`, `review_at 0.5`, `composite_floor 0.7`, and the review weights
   0.4/0.3/0.15/0.15) are **"starting points from the TypeSafe cookbooks"** (TOLD by the README). They are not
   calibrated against anything of SIA's. That is exactly the D-033 calibration slice's job, and the server does not
   do it.
2. **Its input caps exceed Jev's context window (READ both; the consequence is INFERENCE).** `models.md` gives Jev 1.13
   **64k tokens per request, of which 32k is for `state` plus the longest question**. `jev_gate` accepts 50,000
   characters per text field and **200,000 characters of evidence** (`lib.ts:247`, `:250`), roughly 50k tokens of
   evidence alone at ~4 characters per token. A large gate call may therefore be rejected by the API, or silently
   truncated server-side. I could not tell which without calling it, and the brief forbids that. **Stopping there.**
   Whichever it is, `truncated: false` in the response describes the server's own caps, not the model's.

**TypeSafe's own list of weak spots applies to every SIA use (READ, `model-jaggedness/jev-1.13.md`).** Literal reading,
numbers, date comparison, indirection, large state full of irrelevant detail, and "keep the arithmetic in code". A diff
plus a test log is large, indirect state. That is the `jev_gate` use case.

## 3. Fit for SIA, per candidate

**The structural point first (INFERENCE, on READ premises).** SIA already has a Jev client:
`open-brain/src/harness/gate.ts` (585 lines, READ). It POSTs to `JEV_ENDPOINT = https://api.typesafe.ai/v1/systemone`,
reads the key from the environment at call time only, has `DryRunTransport`/`UnconfiguredTransport`/`JevTransport`,
separates **401/422/429/529** into distinct failure classes (the Loop 15 brief §9 requirement), redacts live secrets,
and has tests (`gate.test.ts`, `gate-live.test.ts`). **The runtime calls it from code, at a fixed point in the loop.**
An MCP server is the opposite: the *agent* decides whether and when to call a tool, and what to put in its arguments.
For a gate or a shadow meter, that removes the two properties the record demands:

- **The meter must fire every time, not when an agent thinks of it.** T-155's note says a run where the gate could not
  form a verdict is recorded as UNDEFINED, not as agreement. An uncalled tool produces no record at all.
- **The input must be fixed by the runtime, not chosen by the seat being judged.** If the developer seat picks the
  evidence it hands `jev_gate`, the gate grades the seat's own selection. That is "same-evidence agreement is one
  observation" (the two-agent-roles feedback), and G-039's shape.

| Candidate | Would jev-mcp help? | What is better |
|---|---|---|
| **T-155**, shadow merge gate (candidate C) | **No, as a dependency.** `jev_gate`'s shape is close: a patch review plus claims against evidence, with worst-action-wins. But its policy (weights, thresholds, reason codes) lives in a third party's code, where T-155 wants SIA's `merge.json` policy, zod-validated and drift-checked. Its verdict is returned to an agent, where T-155 needs it written to `artifacts/iterations/tNNN/` **before Aaron decides**. | Plain API via `gate.ts`, called by the runtime at the merge point. **Borrow:** `jev_gate`'s claim criteria (`VERIFY_CLAIM_CRITERIA`), "claims judged from evidence only", and the reason-code vocabulary as design input. |
| **T-173**, effort policy with Jev in shadow | **No.** The question ("does this plan need novel reasoning, or is it mechanical?") is one Choice or Noul the runtime asks *before* launching a `claude -p` stage. No agent is in the loop at that moment to call an MCP tool. | Plain API. `jev_classify`'s design (argmax enforced, a margin requirement, auto only on high top probability **and** a clear margin) is a good template for the shadow judgement's record: log the class, the margin and the distribution. |
| **T-191**, scoring greeting lines per seat | **No.** Scoring happens inside `ob_start` (code), in shadow, against a lookup log. `jev_rerank`/`jev_noul` match the shape, but `ob_start` would have to call an MCP server from inside an MCP server. | Plain API from `ob_start`, shadow-only, **after** the deterministic steps the planner ordered (profiles, then exact-match inclusion). Note: 64 propositions per call (a jev-mcp cap, READ); the API limit is 32k tokens of state (READ). The greeting is ~15k words (T-183), so it must be chunked. |
| **Calibration slice** (D-033) | **Partly, as a reference only.** It is the best worked example I found of mapping Jev answers to auto/review/escalate. But its thresholds are the uncalibrated ones calibration is meant to replace, and routing calls through an MCP server adds a process and a transport between the measurement and the thing measured. | Plain API with raw distributions recorded, since calibration needs the **full probability vector** and the outcome for every call, not a mapped action. jev-mcp's validation rules (probabilities sum to 1 within 0.01; the Score mean matches its distribution within 0.02) are worth copying into `gate.ts`'s answer check. |

**Deterministic-first (Aaron's CLAUDE.md), applied.** In all four cases Jev can be only **a shadow** (T-155, T-173,
T-191: record what it would have done, change nothing) or **an input** to a deterministic policy (calibration: a number
the policy compares against a threshold that SIA set from its own outcomes). jev-mcp's `auto` action is itself a
threshold decision. Adopting it would let a third party's constants act as the gate, which is the thing the rule
forbids.

## 4. Cost and operation

- **Price (READ, `docs.typesafe.ai/models.md`):** Jev 1.13 is **$0.042 per million input tokens; output is free**.
  `docs.typesafe.ai/pricing.md` returns 404, so `models.md` is the only price source I found. The README's "a fraction
  of a cent" is consistent with this (TOLD).
- **Rate limits (READ, `models.md`):** 250,000 tokens/s and 1,200 requests/min; a 429 on excess. The context limits are
  in §2.
- **Latency:** "roughly 150 to 500 ms" is **TOLD** by the jev-mcp README. I found no latency figure in TypeSafe's docs,
  and the Loop 15 brief §9 also left latency unverified.
- **Running it as an MCP server on this desktop (INFERENCE, not measured):** one idle Node process per Claude Code
  session that registers it, spawned over stdio (`StdioServerTransport`). The work happens remotely, so CPU cost while
  idle should be near zero. `jev_extract` spawns a worker thread per regex. **The real cost is per session:** the
  charter notes each open session keeps its own MCP servers, and the 2026-09-26 crash was about session count. Eleven
  more tool schemas in every session's context is also a cost, and T-183 exists because context is already tight.
  **The plain API costs nothing until it is called.**

## 5. Recommendation

**Use the plain API through `harness/gate.ts` for T-155, T-173, T-191 and the calibration slice. Do not add jev-mcp as
a dependency or an MCP server for the loop.** The four uses all need code to call Jev at a fixed point with
runtime-chosen input and to record the raw answer. An MCP server gives the call to an agent and returns a thresholded
action. **What would change my mind:** (a) a seat-side use where an agent *choosing* to ask is the point, and the
answer is logged rather than obeyed. `jev_screen` on fetched web content before it enters a research seat's context is
the one I see, and it is Aaron's to install. (b) TypeSafe shipping an **official** MCP server, which would remove the
single-maintainer, nine-day-old supply-chain question. (c) Evidence that `jev-agent-tools`' transport fixes a failure
`gate.ts` actually hits (the SDK cancellation crash does not apply: `gate.ts` uses `fetch` directly, READ).

## 6. What I did not do, and what is open

- **Did not read `@jkudish/jev-agent-tools`' source.** It carries the default TypeSafe path, so §2's "sends only to
  the provider" rests on `jev-mcp`'s own source plus its SECURITY.md for that hop. It is the next thing to read if
  anyone considers installing the server.
- **Did not run the tests or the server, and made no Jev call** (the brief's rules). The context-window question in
  §2(2) can be settled only by calling the API.
- **Did not open `typesafe-sdk-js#2`** (the cancellation crash). It is TOLD via the README.
- **The Effort line above is unmeasured.** Per the standing rule, it should come from the transcript's per-entry
  `effort` field, which I did not read.
