# Architectural Decision Log

> **Purpose:** Record significant architectural and technical decisions so future sessions have context on WHY things are the way they are.

---

## How to Use This Document

When a significant decision is made (technology choice, pattern adoption, trade-off), add an entry below using this format:

```markdown
### ADR-NNN: [Title]
- **Date:** YYYY-MM-DD
- **Session:** N
- **Status:** Accepted | Superseded | Deprecated
- **Context:** What situation prompted this decision?
- **Decision:** What did we decide?
- **Alternatives Considered:** What else was on the table?
- **Consequences:** What are the trade-offs?
```

---

## Decisions

### ADR-001: Self-Hosted Convex for Persistence
- **Date:** 2026-03-22
- **Session:** 0 (pre-framework)
- **Status:** Accepted
- **Context:** Hub needs persistent state for experiences, tasks, agents, conversations, and repo fixes. Needed semantic search on experience triggers.
- **Decision:** Use Convex (self-hosted via Docker) for all persistent state. Convex provides built-in search indexes and real-time subscriptions.
- **Alternatives Considered:** SQLite (simpler but no built-in search), PostgreSQL (heavier), plain JSON files (no search/indexing).
- **Consequences:** Requires running a Convex container alongside the hub. Schema changes require `npx convex deploy`. Gains semantic search and real-time capabilities.

### ADR-002: Minimal API Token Budget
- **Date:** 2026-03-22
- **Session:** 0 (pre-framework)
- **Status:** Accepted
- **Context:** Hub makes Anthropic API calls for classification and repo fix drafting. Want to minimize costs since heavy LLM work runs on wrapper agents via Claude Max subscription.
- **Decision:** Cap classifier at 50 tokens/call, repo-fixer at 2000 tokens/call. All other LLM work happens on wrapper agents.
- **Alternatives Considered:** Route all LLM calls through wrappers (zero API cost but more complex), run Claude Code on VPS (requires auth setup).
- **Consequences:** ~$0.01/day API cost at moderate usage. Future option to eliminate API dependency entirely by routing through wrappers.

### ADR-003: Express 5 over Alternatives
- **Date:** 2026-03-22
- **Session:** 0 (pre-framework)
- **Status:** Accepted
- **Context:** Need an HTTP server for A2A protocol endpoints and agent coordination API.
- **Decision:** Use Express 5 with async handlers. Simple, well-known, sufficient for the hub's HTTP API surface.
- **Alternatives Considered:** Fastify (faster but more complex), Hono (lighter but less ecosystem), raw Node HTTP (too low-level).
- **Consequences:** Express 5 has native async/await support. Large ecosystem for middleware if needed.

### ADR-004: Per-Task Configurable LLM Models
- **Date:** 2026-03-22
- **Session:** 1
- **Status:** Accepted
- **Context:** Hub's internal LLM tasks (classifier, repo-fixer) were hardcoded to a single Anthropic model. The hub is agent-agnostic — wrapper agents can use any LLM. The hub's own internal tasks should also be flexible, since different models excel at different tasks (fast/cheap for classification, strong reasoning for code fixes).
- **Decision:** Each internal LLM task gets its own env var (`CLASSIFIER_MODEL`, `REPO_FIXER_MODEL`) with sensible defaults. Currently Anthropic SDK only, but structured so multi-provider support can be added later.
- **Alternatives Considered:** Single `ANTHROPIC_MODEL` env var (too coarse — can't optimize per task), multi-provider abstraction now (premature — only 2 LLM tasks exist today).
- **Consequences:** Easy to swap models per task without code changes. Future milestone: abstract the LLM layer to support multiple providers (OpenAI, Gemini, Grok, local) per task.

### ADR-005: Drop Telegram — Build Purpose-Built Messaging App
- **Date:** 2026-03-23
- **Session:** 3
- **Status:** Accepted
- **Context:** Testing the Claude Code Telegram plugin revealed fundamental reliability issues. The plugin delivers inbound messages to Claude Code via fire-and-forget MCP notifications (no `await`, no retry, `.catch()` only logs to stderr). When Claude Code is busy processing a tool call, incoming Telegram messages are silently dropped — no queue, no buffer, no retry. Multiple messages confirmed lost during testing. This is a design limitation of the plugin architecture, not a configuration issue.
- **Decision:** Abandon Telegram as the messaging interface entirely. Instead, build a purpose-built AI messaging app using Convex + Next.js. Convex's reactive subscriptions guarantee message persistence and real-time delivery — messages write to a Convex table and persist until consumed. No fire-and-forget, no silent drops.
- **Alternatives Considered:** (1) Patch the Telegram plugin locally to add retry/queue logic (fragile, fighting upstream design). (2) Run a Telegram bot on VPS writing to Convex as intermediary (adds unnecessary dependency on Telegram). (3) Keep Telegram for v1 and build custom app later (unreliable v1 is worse than no messaging in v1).
- **Consequences:** Telegram integration removed from v1/v2 roadmap. New v2 deliverable: custom messaging frontend (Next.js + Convex). Gains full control over UX, message persistence, delivery guarantees, and multi-device support. Eliminates dependency on third-party bot APIs.

### ADR-006: Protocol Spine — Direct Addressing, Chat Channel, Atomic Claims, Turn Caps
- **Date:** 2026-07-22
- **Session:** 5
- **Status:** Accepted
- **Context:** The hub was hub-and-spoke mediation, not true A2A: escalation picked `agents[0]` with no addressing, and the responding "agent" was historically Aaron via Telegram — a human relay. Aaron's directive: true A2A (2+ agents, no human relay), one codebase for local + VPS, unified multi-orchestration ("both machinery" — runtime peers and dev-time repo agents share one coordination bus), and no Telegram anywhere in the protocol.
- **Decision:** (1) Telegram deleted entirely (code + deps), not env-gated — overrides Atlas's earlier "gate it" guidance per Aaron. Hub notifications go through the chat channel: the hub is a peer, Aaron is a peer (`HUMAN_PEER`, default "aaron"), and hub activity is a session between them. (2) `to:` addressing on `/a2a/message/send` (`params.to` or `message.metadata.to`); addressed messages skip memory and route to the named agent. (3) ADR-005's peers/sessions/sessionPeers/messages tables implemented now (not v2), replacing the dead `conversations` table; session routes: create, send message, poll messages. (4) Turn caps: sessions carry `turnCount`/`maxTurns` (default 16), enforced atomically in `messages.send`, auto-close at cap — two autonomous agents converge instead of looping. (5) `tasks.claim` atomic mutation — first agent wins; serves both runtime wrappers and future dev-time orchestration.
- **Alternatives Considered:** Env-gating Telegram (rejected by Aaron — dead code, and the chat channel replaces it outright); pure P2P agent endpoints (rejected — local agents behind NAT can't be dialed into; hub as rendezvous broker with outbound connections is the workable topology); full A2A spec compliance now (deferred — task lifecycle states, SSE streaming, per-agent cards come after the autonomous 2-agent loop is proven).
- **Consequences:** No push notifications while Aaron is away until the PWA/service-worker phase — acceptable for local-first iteration. Milestone 2 unblocked: the `a2a-agent` wrapper daemon (poll → LLM → respond) is the remaining piece for a zero-human agent exchange. `convex/_generated/api.d.ts` was extended by hand (codegen needs a running backend); regenerate with `npx convex dev` once the local stack is up.

### ADR-007: Session Lifecycle Controls + Deterministic @Mention Reply Routing
- **Date:** 2026-07-23
- **Session:** 6
- **Status:** Accepted
- **Context:** With real-LLM daemons live, three UX gaps surfaced immediately: (1) cap-closed conversations vanished from `listForPeer` and could only be continued by reseeding from scratch; (2) in group sessions (human + 2 agents), every agent answered every human message, and naive gating on "the last message" created a first-responder race that muted the slower agent; (3) agents assumed their counterpart was human and burned turns on identity confusion.
- **Decision:** (1) `sessions.extend` adds turns AND reopens a cap-closed session — conversations resume with transcript intact; `listForPeer` hides closed sessions from daemons but exposes them to viewers via `includeClosed`. (2) @mention routing is enforced **deterministically daemon-side** (regex + participant metadata, never LLM judgment): a message with `@name` mentions is only for those agents; no mentions = ask-the-room (all agents reply) in human-containing sessions; unaddressed agent→agent messages in group sessions get no auto-reply (cascade stopped — agents hand off explicitly with `@name`). Gating keys on "newest message addressed to ME that I haven't answered," not the newest message overall (race fix). (3) Persona teaches agents they are peers among humans and agents plus the @mention convention; transcript lines carry speaker labels with a deterministic strip of mimicked labels on send. DONE detection tolerates trailing punctuation/markdown.
- **Alternatives Considered:** Mention-required in group chats (rejected by Aaron — forgetting the mention would mean silence); first-agent-claims-the-message (rejected — unpredictable responder, needs new claim machinery); hub-side routing metadata (deferred — content-embedded mentions are human-typable and UI-friendly); structured end-of-conversation flag (deferred to v2 — DONE sentinel kept, now punctuation-tolerant, with the known leak that prose ending in "DONE" terminates).
- **Consequences:** Group chats behave like rooms: ask the room or target one agent; conversations are extendable instead of disposable. The sentinel leak and the lack of per-agent personas are the top follow-ups. Client grew into the de facto chat channel (v2 scope pulled forward).

### ADR-008: Persona Resolution & Composition
- **Date:** 2026-07-24
- **Session:** 7
- **Status:** Accepted
- **Context:** Agents needed real roles (mentor/learner for the teaching use case), but the daemon's default persona also carries load-bearing hub conventions (@mention protocol, speaker labels, DONE sentinel). A naive `--persona` override replaced the conventions along with the role, so custom-persona agents would lose the protocol.
- **Decision:** Split persona into two layers, composed at startup: **role text** (who the agent is) resolved by precedence `--persona` flag > `--persona-file <path>` > `personas/<name>.md` convention > none, and **hub conventions** (always appended, never overridable). Persona files live in the repo (`personas/`), resolved relative to cwd, so the launch script needs no per-agent config. `--print-persona` prints the composed system prompt and exits, for inspection without starting the stack.
- **Alternatives Considered:** Persona text inline in `start-stack.ps1` launch args (rejected — multi-line prompts in PS args are unmaintainable); single JSON config for all agents (rejected — one file per agent is git-friendlier and matches the `--name` convention); conventions overridable too (rejected — protocol adherence must be structural, not optional).
- **Consequences:** Personas only describe roles; the protocol can't be accidentally deleted. Adding an agent = one markdown file. Onboarding Brian's Alice later means shipping a persona file with the wrapper package. The agent card description now shows the role (first 120 chars of composed prompt).

### ADR-009: Health Endpoints Probe Their Dependencies
- **Date:** 2026-07-26
- **Session:** 8
- **Status:** Accepted
- **Context:** Session 8 opened onto a stale stack from Jul 22–23 in which the Convex backend on :3210 had died while its `convex dev` wrapper process stayed alive. The hub kept answering `GET /health` with a static `{"status":"ok"}` for roughly three days while every persistence call underneath it failed. The chat client compounded it: `checkHealth()` never inspected `res.ok`, so it would render "online" from any response body that parsed as JSON. Nothing in the system could distinguish "the process is running" from "the service works."
- **Decision:** `/health` performs a real dependency check — a `convex.query(api.peers.list, {})` round trip bounded to 3s by `Promise.race` — and reports the result as a **status code**, not an advisory field: `200 {"status":"ok", "convex":{"status":"ok","latencyMs":N}}` when the database answers, `503 {"status":"degraded","convex":{"status":"unreachable",...}}` when it does not. The probe is bounded so a hung backend surfaces as degraded rather than hanging `/health` itself. The chat client honors `res.ok` and renders `degraded — convex unreachable`.
- **Alternatives Considered:** Keep `200` and add a `convex` field (rejected — every existing `res.ok` caller would keep reporting healthy, which is the exact bug); an unbounded probe (rejected — a hung Convex would hang the health endpoint, converting a fast failure into a timeout); a separate `/health/deep` route (rejected — the shallow route is the one everything already calls, so the shallow route is the one that must not lie); returning `503` only after N consecutive failures (deferred — no evidence of probe flappiness yet, and hysteresis would delay exactly the multi-day outage this fixes).
- **Consequences:** `verify-client-stack.mjs`'s health check now genuinely gates on the database, and `scripts/deploy.sh`'s post-deploy curl fails loudly on a broken backend instead of printing a green line. Any future consumer gets the correct answer from `res.ok` with no special-casing. Verified by killing Convex (`503` in 15ms), then restarting it (auto-recovery to `200`). The connection-refused path is tested; the accept-but-never-respond path relies on the 3s race and was not simulated. Generalizes to any dependency-backed endpoint added later.

### ADR-010: Repo-Resident Peers — Replies From a Rooted Agent SDK Session
- **Date:** 2026-07-29
- **Session:** 11
- **Status:** Accepted
- **Context:** The hub's transport has worked since v1.1.0, but its peers could not answer anything real. `alice` and `bob` are a persona string plus a Messages API call — no tools, no filesystem — so a question like "why does `gitnexus analyze` fail on a lock on `.gitnexus\lbug`" is unanswerable in principle, not just unanswered. Meanwhile the workflow that motivates the project is Aaron hitting a problem in one repo whose cause lives in another, and hand-carrying context between them: the fix gets written into the *other* repo's `next-session.md` and waits until he happens to open that repo. That is store-and-forward with a human as the scheduler. The file-based mailbox protocol has the same shape and the same bottleneck.
- **Decision:** A peer launched with `--repo <path>` generates replies from a **Claude Agent SDK session rooted at that path** (`src/wrapper/repo-reply.ts`) instead of from its persona. The swap happens at the single existing seam — `generateReply(transcript)` — so mention gating, turn caps, DONE detection, and the no-cascade rule are untouched. Three deliberate constraints: `settingSources: ["project"]` loads the target repo's own `CLAUDE.md` and `.claude/settings.json` but **not** the operator's global settings (those describe how Aaron works, not how the repo behaves); `disallowedTools` — never `allowedTools` — enforces read-only, because in the Agent SDK `allowedTools` only auto-approves and does not restrict, so an allowlist would leave `Write` reachable through the permission flow; and `permissionMode: "dontAsk"` denies anything that would otherwise prompt, since a daemon has nobody to approve one and the alternative to denying is hanging forever. `scripts/ask-agent.mjs` is the entrance from a live coding session — register → open a 2-peer session → send → poll — because the only prior ways in were the chat client (a human typing) and a daemon (autonomous), and a Claude Code session is neither.
- **Alternatives Considered:** A separate `repo-agent.ts` daemon (rejected — it would fork the session loop and re-inherit every bug just fixed in v1.5.2; the difference is one function); Claude Code subagents instead of hub peers (rejected — the PRD calls subagents better for same-machine orchestration *because they share context*, but that is exactly what makes them wrong here: a subagent spawned from A2A-Hub loads the target repo from zero, whereas the value is that the target repo's agent already holds its own `.agents/` state and accumulated gotchas — this is cross-**context**, not cross-machine, and the hub's edge applies to both); the Messages API tool runner (rejected — it has no built-in file tools, so we would be reimplementing Read/Grep/Glob); MCP server on the hub as the entrance (deferred, not rejected — cleaner than a script and fits how Aaron already works, but ADR-006/007 already superseded an MCP channel layer once and that reasoning deserves re-reading before reviving it); building store-and-forward first (rejected as strictly dominated — hub messages already persist, so a message left for an offline peer *is* store-and-forward; the ask path subsumes it).
- **Amendment (Session 11, same day) — two things the first pass got by accident:**
  1. **Repo peers are network-isolated, and that is now deliberate.** Only `Write`/`Edit`/`NotebookEdit`/`Bash` were denied explicitly, but `WebFetch` and `WebSearch` require approval and `permissionMode: "dontAsk"` denies rather than prompts — so a repo peer has no network access at all. Discovered when the `gitnexus` peer was asked whether its version was the latest on npm and correctly reported that it could not reach the registry. **Keeping it**, for a reason worth stating: a repo expert should answer from the repo, and an isolated peer cannot be turned into an exfiltration path by a question from another agent — which matters much more once peers answer requests from other machines. The cost is that a peer can never answer "is this dependency current"; the asking side must supply that. Anyone re-enabling the network tools should treat it as a security change, not a capability tweak.
  2. **Replies carry provenance.** `readRepoProvenance()` appends the branch, short SHA, and a dirty-tree flag to every reply. A repo peer is only as current as its checkout and a stale checkout is *silent* — the answer comes back just as confident. The `gitnexus` peer was answering from a side branch 867 commits behind `origin/main` at version 1.6.3 while the installed CLI ran 1.6.9, and nothing in its replies hinted at it; it only surfaced because a version question was asked directly. Provenance is computed by the daemon with `execFileSync`, not requested of the agent, precisely because Bash is denied to it. Non-git paths return `null` and add no footer rather than failing the reply. Note the footer is inserted **before** a trailing `DONE`: the daemon detects convergence by testing whether the newest message *ends* with the sentinel, so appending after it would have silently stopped sessions from ever converging — there are tests on that specific interaction, mutation-verified.
- **Consequences:** A peer can now answer from a codebase it is resident in, verified live: asked about the `.gitnexus\lbug` lock, the `gitnexus` peer returned the mechanism plus four file:line citations, every one checked verbatim against the repo — and in doing so diagnosed the GitNexus re-index failure that blocked Sessions 8 and 9 here. Read-only is the default and Bash is opt-in (`--repo-bash`), which is also the ceiling on the current design: without Bash the peer cannot search git history, one of the things a repo expert should be best at. Cost is bounded per reply by `maxBudgetUsd` (default $0.50) and `maxTurns: 12`, an order of magnitude above the hub's other budget caps — a repo peer is not a 50-token classifier and should not be priced like one. Latency is ~40s for a real question, so `ask-agent.mjs` defaults to a 150s timeout; the SDK's `startup()` warm-query helper is the lever if that becomes the complaint. Not yet addressed: a peer must already be running to answer, so on-demand spawn (hub sees a message for an unregistered repo peer, launches a headless agent rooted there, lets it exit) is the piece that would actually retire the mailbox rather than out-competing it.

### ADR-011: Name Ownership (8.2 Partial) and Daemon Instance Supersede
- **Date:** 2026-09-20
- **Session:** 13 (Clark designed; cursor seat built)
- **Status:** Accepted
- **Context:** A name is not an identity. Two independent sightings: (1) two daemons can register the same peer name after `Stop-Process` orphans a node child — both answer, `repliedTo` is per-process so it dedupes nothing; (2) two `hub-talk --wait` listeners under one name race the same cursor. Same *shape*, different layers. PRD 8.2 asks to namespace peer identity by owner so two machines can each run a `gitnexus` peer. Full namespacing is qualified names, which changes addressing, which changes every client. Hub-talk is load-bearing and forbidden to edit. Also: `hub-talk` calls `register(ME)` on every invocation, so rejecting a second registration for a live name would break every seat.
- **Decision:** Do **not** close 8.2 outright. Ship the cheap half: a name is **owned**, so a collision is detected instead of silently shared. Qualified addressing waits for per-agent keys (v3). Two independent layers, not merged:
  - **Layer A — identity.** Owner is `apiKeyHash`, already on the row. Same hash → silent idempotent re-register (the constant hub-talk path). Different hash → `WOULD REJECT name claim` in `AUTH_MODE=warn`, `409` in strict. Ships dark: every seat currently shares `dev-key`, so they hash alike and behave as today until real keys land.
  - **Layer B — instance.** Long-lived pollers only. `daemon.ts` generates `instanceId` at startup and sends it on register and heartbeat. Hub stores optional `activeInstanceId` + `lastHeartbeatAt`. **Register with `instanceId` is the takeover** (newest wins, even if the current holder is fresh). Heartbeat renews the lease if the caller is active or the holder is stale; if the caller is not active and the holder is fresh, heartbeat returns `409 superseded` and the loser exits. Clients that omit `instanceId` (hub-talk, ask-agent) neither supersede nor get superseded.
  - **Supersede, not reject.** The observed failure is a restart that left an orphan. The operator's intent is for the new process to serve. Rejecting the newcomer leaves the stale build answering (the Session 11 bug). Newest-wins self-heals: the orphan exits on its next heartbeat.
  - **Liveness window is 45s** — the existing `GET /a2a/agents/live` cutoff, not a new number. A process that has not instance-heartbeat within that window is not live.
- **Alternatives Considered:** Reject a second registration for a live name (rejected — hub-talk re-registers on every `--say`/`--inbox`/`--wait`). First-wins / reject the newcomer (rejected — restart silently fails and the orphan keeps answering). Newest-wins on every heartbeat (rejected on contact with the code — two live daemons would flip-flop every `POLL_MS`). Full `owner/name` qualified addressing now (rejected — every client would change). New required fields + migration (rejected — existing rows have no owner; optional fields keep legacy behaviour).
- **Consequences:** No migration. AUTH_MODE stays warn. Hub-talk/ask-agent unchanged. This is **8.2 partial**: names are owned, not namespaced. Layer A is inert until per-agent keys exist. Layer B only affects daemons that send `instanceId`. The two-listener hub-talk cursor race is client-side and is not fixed here.

### ADR-012: Ask Policy — Who May Ask This Peer (8.3 Concept)
- **Date:** 2026-09-20
- **Session:** 13 (Clark designed; cursor seat built)
- **Status:** Accepted
- **Context:** A repo-resident peer reads files on request. Locally that is Aaron asking Aaron's disk. Across machines it is a remote party causing reads on someone else's disk. Read-only (ADR-010) narrows blast radius but does not answer who may ask. PRD 8.3 requires the *concept* with a permissive local default, so adding policy later is filling in a value, not introducing a layer.
- **Decision:** Optional `askPolicy: { allow: string[] }` on the agent row. **Absent = allow all = today's behaviour.** Setting a policy is the opt-in; there is no warn/strict twin. Enforcement is where a message is routed to a named peer, and the asker is `req.agentName` from Layer A middleware — identity is not re-derived. Denial is `403` with `error: "askPolicy denied"` and a `reason` that names the policy and the two peers. An empty `allow` is a present policy (deny everyone authenticated), not "absent". A future `what` field can sit beside `allow` without migrating existing rows. Enforcement points that have `req.agentName`: `POST /a2a/message/send` when `to` is set, and `POST /a2a/session/:id/message` against other session participants (the ask-agent path).
- **Inertness (state plainly):** every seat currently shares `dev-key`, so `req.agentName` resolves by a hash they all share and is not a trustworthy asker identity yet. This ships dark and becomes real with per-agent keys. An unauthenticated warn-mode caller (`req.agentName == null`) is allowed, matching today.
- **Alternatives Considered:** A policy engine with modes (rejected — 8.3 is a concept, not an engine). Empty-list-deny when the field is missing (rejected — absent must mean absent). Re-deriving the asker from `from` / message role (rejected — that is self-asserted; Layer A already populated `req.agentName`). Threading identity into `HubAgentExecutor` via a custom `UserBuilder` so JSON-RPC `metadata.to` can enforce (not taken — Clark said stop rather than work around a missing `req.agentName`; the spec executor does not see the Express request).
- **Consequences:** No migration, no client changes, AUTH_MODE stays warn. JSON-RPC named addressing (`metadata.to`) is an enforcement gap (`UserBuilder.noAuthentication`, so `HubAgentExecutor` never sees `req.agentName`) — close it before the legacy `/a2a/*` routes retire, or the only path that enforces askPolicy disappears. Hub-talk rooms keep working because no peer has an `askPolicy` today.

### ADR-013: Ambiguous Silence Must Fail Closed
- **Date:** 2026-09-21
- **Session:** 13
- **Status:** Accepted
- **Context:** Five defects surfaced in one session, found five different ways, and they are one class rather than five bugs. Each left a mechanism that looked healthy while losing information, because "nothing happened" and "something was lost" were indistinguishable to the party who needed to tell them apart.
  1. **Read cursor advanced on a write.** `--say` moved the reader's cursor past unread peer turns, so a reader could not distinguish "nothing arrived" from "I skipped it." Two real turns vanished in two rooms while both looked healthy. Found in use, not review.
  2. **The diagnostic consumed its evidence.** `--inbox` — the "did I miss anything" check — advanced the cursor, destroying proof of a skip in the act of showing it. Found by the QA seat reviewing the fix for (1).
  3. **Silence versus no listener.** The transport has no push, so a participant cannot distinguish "no messages" from "nobody is waiting." Found by an outside Grok bot with no stake in the design: *"so that 'nobody was listening' cannot silently look like a healthy empty room."*
  4. **`/health` proved the wrong thing.** It probes `peers.list`, whose signature never changes, so it returned 200 with `latencyMs: 2` throughout an outage in which every write failed. A readiness check that only proves the database is reachable passes while every changed function is broken.
  5. **`rc 1` conflates two opposite meanings.** `hub-talk`'s contract defines rc 1 as "usable error, non-retryable," but a backend that is *down* returns 500 and therefore rc 1. The documentation instructs a client to stop dead during a transient outage. A Cursor agent recovered only by ignoring the contract and retrying anyway.
- **Decision:** Treat ambiguous silence as a defect class, not as individual bugs. Where a mechanism can leave an observer unable to distinguish *nothing happened* from *something was lost*, it must **fail closed** — over-report, re-deliver, or refuse — rather than stay quiet.
  - A cursor moves on a **read**, never on a write.
  - A diagnostic read is **non-destructive**; consuming is a separate, explicit act.
  - A readiness check must exercise a signature that **changed**, not one that cannot fail.
  - An error code must distinguish *you called this wrong* from *the service is down*; they demand opposite client behaviour.
  - Prefer redundant delivery to silent loss. Replaying a backlog is noise; skipping a turn is data loss.
- **Alternatives Considered:** Fixing each as an isolated bug (rejected — four were found by four different parties in one session, which is the signature of a class, and a fifth will appear elsewhere if the pattern is not named). Preferring quiet correctness — suppressing duplicates to keep output clean (rejected — every defect above was the result of optimising for tidiness over certainty).
- **Consequences:** Accepted costs, all of them noise rather than loss: a reader with no cursor replays a room once; `--inbox` and a following `--wait` deliver the same turn twice; a client that cannot tell an outage from its own mistake retries when it need not. Outstanding under this ADR: `rc 1` still conflates the two meanings (needs a distinct code or an explicit retryable-with-backoff rule), and `--inbox` has no opt-in `--mark-read`, so the double-delivery is unavoidable rather than chosen. Both are recorded in INBOX; neither was fixed at the end of the session that found them.
