# Task Inbox — Prioritized Backlog

> **Last Updated:** Session 11 (2026-07-29) — repo-resident peers shipped as v1.6.0 (ADR-010): a peer can answer from a codebase it's resident in, verified live cross-repo with citations. Everything through v1.5.2 is pushed

---

## How to Use This Document

Tasks are organized by MVP version, then by priority within each version.

**Status:**
- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done
- `[!]` — Blocked

---

## v1 — Autonomous loop, verified locally

> **Goal:** True A2A — 2+ agents converse through the hub with zero human relay, verified on the local stack (VPS was wiped; redeploy comes later).
> **Effort:** Days.

- [x] Protocol spine: `to:` addressing, chat channel (peers/sessions/messages), atomic `tasks.claim`, turn caps (v1.1.0, ADR-006)
- [x] Delete Telegram entirely — replaced by chat channel, humans are peers (v1.1.0)
- [x] Wrapper daemon (`src/wrapper/daemon.ts`): register → poll → claim → respond; session conversations; LLM or fallback (v1.2.0)
- [x] **Autonomous 2-agent loop gate PASSED** — alice ↔ bob, 6 turns, DONE convergence, zero human (`scripts/demo-loop.mjs`, v1.2.0)
- [x] Svelte test client (`client/`, plain Svelte + Vite on :5173) — textbox → `/a2a/message/send` → response pane, `to` addressing; verified via `scripts/verify-client-stack.mjs` (v1.3.0)
- [x] **Real-LLM gate PASSED** (v1.4.0, Session 6) — alice↔bob on Haiku, DONE convergence, zero human. **v1 milestone complete.**
- [ ] Experience dedup — `triggerHash` + upsert in `experiences.store` (plan in forge-to-atlas.md)
- [ ] docker-compose profiles: local (no Traefik, local Convex) + VPS (Traefik, prod URLs) — one env-gated build

## v2 — Cross-repo agent-to-agent, proven locally

> **Goal:** Any repo's agent can ask any other repo's agent a question and get a grounded answer, with no human relaying and no peer needing to be hand-started. Renamed 2026-07-29 (PRD v1.2) when cross-repo was promoted to the primary use case — the chat/UX and developer-experience items that used to live here moved to v3, since they serve the remote/Brian goal.
>
> Completed items below predate the renumbering and are kept in place rather than re-filed.

- [x] Grow Svelte client into chat UI: date-grouped history, live transcripts, send as `aaron` peer, rename, extend (v1.4.0, Session 6)
- [x] Session extend/reopen + @mention reply routing, deterministic daemon-side (v1.4.0, ADR-007)
- [x] **Per-agent personas with real roles** — role text auto-loads from `personas/<name>.md` (or `--persona`/`--persona-file`), composed with hub conventions; alice=learner-assistant, bob=mentor; `--print-persona` for debug (Session 7)
- [x] **`start-stack.ps1`** — one-click Convex + hub + daemons + client in Aaron-owned terminals, with build step + port-readiness waits (Session 7; ASCII-only, PS 5.1-safe)
- [x] **Live verification of Session 7 work** (Session 8) — stack cold-started, `verify-client-stack` 5/5, persona demo `GATE PASSED`, shipped as v1.5.0
- [x] **`/health` probes Convex** (Session 8, ADR-009) — `503 degraded` when the DB is unreachable; client honors it. Failure path tested by killing Convex
- [x] **`REPO_FIXER_MODEL` 404 fixed** (Session 8, v1.5.1) — `claude-sonnet-4-20250514` retired 2026-06-15; now `claude-haiku-4-5-20251001`, so the whole hub is on Haiku 4.5
- [x] **`@`-parsing over-match fixed** (Session 10, v1.5.2) — gating extracted to `src/wrapper/mentions.ts` and gated on session participants; 11 unit cases, mutation-verified, confirmed live in a 3-participant session
- [x] **Stale turn counter fixed** (Session 10, v1.5.2) — header reads the live count off `transcript`; poll re-lists sessions every 5th tick
- [x] **Push v1.5.0 + v1.5.1 + v1.5.2** (Session 10) — pushed with tags; nothing had left the machine since Session 7
- [x] **Repo-resident peers + `ask-agent.mjs`** (Session 11, v1.6.0, ADR-010) — `--repo <path>` answers from an Agent SDK session rooted in that repo; `ask-agent.mjs` is the entrance from a coding session. Verified live cross-repo with four verbatim-checked citations
- [x] **PRD §1 use-case priority amended** (Session 11, PRD v1.2, Aaron's call) — cross-repo is now the primary use case with its own roadmap phase (v2) ahead of the Brian/remote work (v3). §8 gained three named trust-domain prerequisites

### Prerequisites — the current phase

> These four are the phase. The three security items are **prerequisites, not hardening**: nothing local fails without them, which is precisely why they have to be decided rather than discovered. See PRD §8.

- [ ] **Two cheap repo-peer measurements** (Session 11 addendum, Aaron asked for these first) — (a) does the peer still authenticate without `--env-file=.env`? Today it bills metered `ANTHROPIC_API_KEY`; a pass does **not** justify flipping the default (terms question, and the API key is what gives `maxBudgetUsd` enforcement + per-reply cost visibility). (b) Opus 5 vs Sonnet 5 on the same lookup via `REPO_AGENT_MODEL` — cost, latency, citation accuracy. Opus floor measured at $0.099/turn with every tool denied
- [ ] **On-demand spawn** — hub launches a headless agent for a repo peer that isn't running, then lets it exit. Removes the last "wait until a human starts something," and is what retires the file mailbox rather than out-competing it
- [ ] **Validate `X-Agent-Key`** (PRD §8.1) — every guarded route only checks presence; a bogus key returns 200. `apiKeyHash` is stored at registration and never compared, so this is close to a one-function fix. Until it lands, the local system runs a *different* security model than the remote one, which defeats the point of proving the protocol locally first. Note `ask-agent.mjs` now registers ephemeral peers freely, so the surface is wider than it was
- [ ] **Namespace peer identity by owner** (PRD §8.2) — peer names are bare strings unique by convention; two machines each running a `gitnexus` peer collide with no owner field to disambiguate. Do it before two machines exist, not after they collide. Local default should keep it invisible day-to-day
- [ ] **"Who may ask this peer what" as a concept** (PRD §8.3) — with a permissive local default. A repo peer reads files on request; locally that's Aaron asking about Aaron's disk, remotely it's a remote party causing reads on someone else's. Read-only (ADR-010) narrows the blast radius but doesn't answer who may ask. Adding policy later should mean filling in a value, not introducing a layer

### Cross-repo polish (same phase, lower priority)

- [ ] **Scoped Bash for repo peers** — `Bash(git log *)` / `Bash(git show *)` so a repo expert can answer "when did this change and why" without opening full shell access
- [ ] **Two daemons can register the same peer name and race** — found in Session 11 while restarting the `gitnexus` peer. `Stop-Process` on a daemon's *window* leaves its node child orphaned and still polling, so a "restart" produces two live daemons for one name. Both see the same trigger, both try to answer, and `repliedTo` is per-process so it dedupes nothing across them — the reply you get is whichever won the race, which is how a stale build answered a question after a "restart." Fix at the hub: reject or supersede a second registration for a live peer name (heartbeat makes liveness knowable). Related to peer identity namespacing (PRD §8.2) — same root cause, that a name is not an identity
- [ ] **Test a citation self-check in `repoConventions`** — Session 11 caught the `gitnexus` peer fabricating `gitnexus/src/cli/commands/mcp.ts` (real path: `src/cli/mcp.ts` — it invented a `commands/` segment) and attaching a *real* line number to a wrong claim (`package.json:17` is inside `"keywords"`, not a command registration). Candidate fix: instruct the peer to confirm a path with Read or Glob before citing it. **Measure before adopting** — Anthropic's current-model guidance says explicit verification instructions cause *over*-verification and should be deleted rather than added, so this may buy accuracy at the cost of slower, hedgier answers. Compare citation accuracy and latency with/without on a fixed question set rather than assuming
- [ ] **Vague questions get sloppy citations** — the fabricated answer came from "name one file that implements X" and returned in 18s; the 4/4-exact answer came from a specific question and took 43s. May be a usage note (`ask-agent.mjs --help`, README) rather than a code change. Worth confirming the correlation on more than two samples before writing it down as guidance
- [ ] **Repo → peer discovery** — so `ask-agent.mjs` takes a path instead of a hand-passed name
- [ ] **`start-stack.ps1`: Convex window loses its title** — it should read `A2A Convex` but shows `C:\Windows\system32\cmd.exe`. Likely cause: `npx` shells through `cmd.exe` on Windows, which overwrites the title *after* `$Host.UI.RawUI.WindowTitle` is set. This is the most load-bearing window in the stack presenting as the most disposable one — closing it takes Convex down and every write with it (the Session 8 three-day failure). Fix: re-assert the title after the process starts, or set it from a prompt function so it survives the overwrite
- [ ] **`start-stack.ps1`: clean up orphaned A2A windows** — windows open with `-NoExit`, so when a daemon's node process dies (e.g. the Convex-timeout cascade takes alice/bob with it) the window survives as an empty shell. A re-run then starts fresh daemons in *new* windows and stacks them beside the dead ones; Session 11 ended with 2 zombie windows out of 8. Fix: on startup, close A2A-titled windows whose node child is gone. Note the check must look for a **node child specifically** — every console window has a `conhost.exe` child, so "has any child" always matches
- [ ] **Raise `start-stack.ps1`'s Convex readiness wait** — 120s is too short from cold, and the failure cascades silently (script continues, daemons die with it, `verify-client-stack` then fails on checks unrelated to the code under test)
- [ ] **Decide the entrance shape** — keep the script, or expose the hub as an MCP server (`a2a_ask(peer, question)`). Re-read ADR-006/007 first; an MCP channel layer was superseded once, though for a different purpose
- [ ] ~~`scripts/register-agent.mjs`~~ — largely subsumed by `ask-agent.mjs` (same register → session → send → poll flow). Keep only if a heartbeat/queue smoke test is still wanted separately
- [x] **GitNexus re-index unblocked** (Session 10) — analyze now completes with the MCP servers running. Root cause found by the `gitnexus` peer itself in Session 11: `run-analyze.ts:262-272` swallows the Windows sharing violation on `fs.rm`, and `initLbug` (unlike the query paths) has no busy-retry, so it's a race with a live MCP server rather than a hard block
- [x] Change `CLASSIFIER_MODEL` default in code — now `claude-haiku-4-5-20251001` (Session 7). NOTE: `REPO_FIXER_MODEL` default is still the 404-ing sonnet-4 id (repo-fixer unused in current loop)
- [x] Convex health check on `/health` — shipped Session 8 as ADR-009 (`503 degraded`, not an advisory field)

### v2 / v3 boundary

- [ ] **askPolicy is not enforced on the JSON-RPC path** — `jsonRpcHandler` uses `UserBuilder.noAuthentication`, so `HubAgentExecutor` never sees `req.agentName`. `metadata.to` therefore routes with no asker identity. Close this BEFORE the legacy `/a2a/*` routes are retired — retiring them while the gap is open would remove the only path that enforces policy. Likely shape: a custom `UserBuilder` carrying the authenticated peer name. Not designed yet. See ADR-012.

- [ ] **`hub-talk` exit code 1 means two opposite things** (ADR-013). The documented contract is `0` turn printed, `1` usage error or non-retryable failure, `2` wait timeout. But a hub that is *down* returns 500, which surfaces as rc 1 — so the documentation instructs a client to stop dead during a transient outage and never come back. This is not theoretical: during the 2026-09-21 split-deploy outage a Cursor agent's waiter took ten rc-1 exits in 31 seconds and recovered **only because it retried anyway**, contrary to the contract. A client that obeyed the documentation would still be stopped. Fix: a distinct code for "service unavailable, retry with backoff" (the 5xx/network case) separate from "you called this wrong" (usage, 4xx, send rejected), or an explicit retryable rule in the header comment. Whatever shape, it changes a contract every client depends on, so it wants a design pass rather than a patch — and `scripts/hub-talk.mjs` is load-bearing for every agent.

- [ ] **`--inbox` has no opt-in `--mark-read`** (ADR-013). `--inbox` is deliberately non-destructive so the "did I miss anything" check cannot destroy the evidence it is reporting, and `--say` never moves the cursor. Both rules are individually correct. Composed, they mean an `--inbox` followed by a `--wait` re-delivers everything the inbox just showed: the cursor never moved, so the waiter correctly treats it as unread. Observed live — a waiter fired immediately on a turn that had just been read by hand and burned a cycle on it. The fix is not to make `--inbox` consume by default; it is an explicit `--mark-read` so a reader can say "I have seen these" as a separate, deliberate act. Small API addition, and the double-delivery is only noise, so it has never blocked anything.

## v3 — Remote teaching (Aaron + Brian) + chat/UX

> **Goal:** Use case 2 becomes real — Brian installs a wrapper in minutes and Alice talks to Aaron's agent over the internet, with the chat UI as the daily driver for watching and steering. Gated on v2 *and* on Brian's availability, which is why it now follows cross-repo rather than leading.

- [ ] **Onboard a truly remote agent — the ordered sequence.** A Grok bot on its own Linux host asked to join on 2026-09-20 and could not: the hub lives on a Tailscale address, so a process outside the tailnet cannot route to it at all. It ran its calls from Aaron's desktop instead — a remote brain driving a local hand, which proves nothing about remote participation.

  Putting its host on the tailnet was rejected deliberately, and the reason is the point: **Brian will never be on Aaron's tailnet.** An agent that needs private network access to reach the hub is not the v3 scenario; it is v2 with extra steps. Network-level access is standing in for application-level auth, and swapping one for the other is the whole of v3. A tailnet auth key also grants far more than the hub — the tailnet holds `mailserver`, `vps`, `worthitwindows-vps` and two desktops, and Tailscale's default ACL is allow-all.

  Do these in order; several will disconnect every agent at once if done early:
  1. **Redeploy tcm with v1.7.0.** `54d35e1` (`cp -r convex/_generated dist/...`) must travel or the image crashes at import. Best window is when Aaron rolls the seats — the disruption is already paid for, and the seats restart with fresh config anyway.
  2. **Provision per-agent keys at that same roll.** Every agent runs on `daemon.ts`'s default `dev-key` today, so validation currently distinguishes "knows the string dev-key" from "doesn't" and establishes no peer identity. Remove the `dev-key` fallback so nobody ships it by accident.
  3. **Leave `AUTH_MODE=warn` and read the logs until they are quiet.** Strict before the keys exist 403s every agent mid-loop, including the rooms that would carry the message saying what broke.
  4. **Flip `AUTH_MODE=strict`.**
  5. **Expose the hub.** `tailscale funnel 4000` on tcm is one command and gives HTTPS without port forwarding.
  6. **Remote agent registers with its own key** over the public URL. That is the test.

  **Three things must be true before step 5, and one is not yet:**
  - **Revocation is unverified against real data.** `register` now collapses duplicates and deletes the extras, but the collapse is capped at 4000 deletes per call and has only ever been run in tests. The live DB held ~39 historical rows, each with its own `apiKeyHash`, and `getByKeyHash` matches any of them — so if old rows survive, a superseded key still authenticates. Untidy on a tailnet; a hole on a public URL. **Verify against the live database before exposing anything.**
  - **`askPolicy` is not enforced on the JSON-RPC path** (see the v2/v3 boundary item). Harmless while every policy is absent; it stops being harmless the moment there is a genuine outsider.
  - **No rate limiting or abuse protection** (v4 item). A public endpoint without it is a different risk profile than a tailnet one.

  The useful part: this list came from a consumer trying to join, not from us guessing at what remote access would need.

- [ ] **Real-network failure modes** — TLS/DNS, connection dropped mid-answer, retry/idempotency, version skew between two machines, CORS from a non-localhost origin. The genuinely new surface no local test can reach. **Partially exercised 2026-09-20:** the Grok bot hit the very first one — it could not route to the host.
- [ ] **Per-agent key generation + rotation**, deprecate shared `dev-key` and bootstrap key. Builds on v2's key *validation*: v2 closes the hole, v3 makes key management usable
- [ ] Redeploy hub + Convex on VPS (Docker Compose, `restart: unless-stopped`); docker-compose local + VPS profiles
- [ ] npm wrapper package (`a2a-agent` CLI) — `npx a2a-agent --hub URL --name alice`; package `src/wrapper/daemon.ts`
- [ ] End-to-end test with Brian (Alice ↔ Aaron's agent, remote)
- [ ] Structured end-of-conversation flag — replace the DONE sentinel (prose ending in "DONE" terminates conversations)
- [ ] Client: session delete + bookmarks (deferred from Grok-parity pass)
- [ ] PWA setup (service worker, manifest) — restores away-from-desk notifications lost with Telegram
- [ ] `agents.register` should upsert (currently duplicates rows on re-register)
- [ ] Request validation middleware (A2A message format)
- [ ] Structured logging (pino)
- [ ] A2A spec alignment: task lifecycle states (`submitted/working/input-required/...`), `message/stream` SSE, per-agent cards
- [ ] Repo-fix approval flow through chat channel (`input-required` task to human peer; was Telegram buttons)
- [ ] Experience dedup — `triggerHash` (sha256 of normalized trigger) + `by_triggerHash` index; patch-on-conflict in `experiences.store`

## v4 — Platform & multi-orchestration dogfood

> **Goal:** Hub becomes a product; the same bus coordinates dev-time agents on this repo ("both machinery", ADR-006).

- [ ] Register dev agents (Forge, resurrected Atlas) on the hub; migrate file mailbox → hub sessions. Note: v2's on-demand spawn is most of this — once a repo peer answers without being hand-started, the mailbox has no remaining job
- [ ] Orchestrator role: decompose → fan out via `tasks.claim` → fan in; worktree-per-agent for parallel edits
- [ ] Multi-provider LLM abstraction (ADR-004 follow-on)
- [ ] Makerspace website integration — Stripe billing, member-facing chat
- [ ] Advanced escalation — capability-based multi-agent routing
- [ ] Rate limiting and abuse protection
- [ ] SECURITY.md with full auth patterns and audit checklist

---

## Completed (pre-Session 5 history)

- [x] Core modules (classifier, memory, executor, escalation, queue, repo-fixer, agent-card)
- [x] Convex schema + deploy; Docker/Compose config; VPS deploy (later wiped)
- [x] Vitest suite (classifier, executor, queue, integration — 10 tests)
- [x] CHANGELOG.md + tagged releases (v1.1.0, v1.2.0)
- [x] Per-task configurable LLM models (ADR-004)
- [x] README with wrapper quickstart

### Dropped
- ~~Configure Telegram~~ — Telegram removed entirely (ADR-006)
- ~~Test with Brian via Telegram visibility~~ — superseded by local gate + chat channel; Brian testing returns post-VPS-redeploy
- ~~Next.js dashboard~~ — superseded by Svelte client growing into chat UI (v2)
