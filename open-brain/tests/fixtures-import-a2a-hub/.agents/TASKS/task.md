# Current Sprint

> **Focus:** v2 — cross-repo agent-to-agent, proven locally. **All three trust-domain prerequisites (PRD §8) closed in Session 14** and shipped as v1.7.0. What remains in v2 is on-demand spawn; what remains before anything goes *remote* is verifying revocation against the live database.

---

## Active Tasks

1. **Two cheap repo-peer measurements (Aaron asked for these first, Session 11 addendum)** — (a) launch the repo-peer daemon *without* `--env-file=.env` and see whether `apiKeySource` changes or auth fails; do **not** flip the default on a pass (terms question + loses `maxBudgetUsd` enforcement). (b) run one lookup question under Opus 5 vs Sonnet 5 via `REPO_AGENT_MODEL` and compare cost, latency, citation accuracy — the Opus per-turn floor measured $0.099
2. **On-demand spawn** — hub receives a message for a repo peer with no live daemon → launches a headless agent rooted at that repo, gets the answer, lets it exit. Zero idle cost, and the piece that actually retires the file mailbox instead of out-competing it
3. **Verify revocation against the live database** — **the gate before anything is exposed publicly**, and the one condition in the remote-agent sequence that is not yet true. `agents.register` now patches a canonical row and deletes the extras, but that has only ever run in tests. The live DB held ~39 historical rows for ~5 agents, each carrying its own `apiKeyHash`, and `getByKeyHash` matches *any* of them — so a surviving row means a **superseded key still authenticates**. The collapse is also capped at 4000 deletes per call and self-heals across subsequent registers, so a backlog clears over several calls rather than at once. Read-only investigation first: count rows per agent name, confirm whether stale hashes remain after the registers that have already happened. Do **not** improvise fixes against live data — report first
4. ~~**Validate `X-Agent-Key`** (PRD §8.1)~~ — **DONE** Session 14, `95ca5c6`. Keys resolve against the stored hash; `AUTH_MODE=warn` logs rejections without enforcing
5. ~~**Namespace peer identity by owner** (PRD §8.2)~~ — **DONE (partial)** Session 14, `95f2433`, ADR-011. Names are *owned* via `apiKeyHash` and daemon instances supersede. **Not** full namespacing — qualified `owner/name` addressing would change every client and waits for per-agent keys
5a. ~~**"Who may ask this peer what"** (PRD §8.3)~~ — **DONE** Session 14, `d9dfaed`, ADR-012. Optional `askPolicy`, absent = allow-all. Gap: not enforced on the JSON-RPC path — close before retiring the legacy routes
6. **Scoped Bash for repo peers** — `Bash(git log *)` / `Bash(git show *)` so a repo expert can answer "when did this change and why" without full shell access
7. **Experience dedup** — `triggerHash` (sha256 of normalized trigger) + `by_triggerHash` index; patch-on-conflict in `experiences.store`
8. **docker-compose profiles** — local (no Traefik, local Convex, :5173 client) + VPS (Traefik, prod URLs); one env-gated build. Now v3 work — deprioritized behind the v2 prerequisites

## Done This Sprint (Session 14, 2026-09-20/21)

- [x] **Shipped v1.7.0, tagged and deployed to tcm** — all three §8 prerequisites, the spec JSON-RPC transport, a truthful agent card. Suite 40 → 84, 17 commits
- [x] **Fixed the seat transport silently dropping turns** — a `--say` advanced the reader's cursor past unread peer turns; two real turns vanished in two rooms in one afternoon. Cursor is now a turn number that only a *print* moves. Also: `--inbox` reports without consuming, `--peer` picks the room for that pair instead of whichever was open, new rooms cap at 500 not 64
- [x] **ADR-013 — ambiguous silence must fail closed.** Five defects in one session, found five ways by four parties, are one class: a mechanism that looks healthy while losing information
- [x] **Recovered a split-deploy outage** and wrote `docs/redeploying-tcm.md`. A redeploy is **two** deploys and the Convex functions go first; `/health` cannot catch version skew and returned 200 throughout; tag the outgoing image or there is no rollback
- [x] **Proved cross-vendor agent work** — a Claude Code planner and a Cursor Grok 4.6 implementer closed §8.1–8.3 together over a hub room with no human relay, the implementer correcting the planner's design twice
- [x] **`docs/joining-the-hub.md`** — how a third-party agent registers, written from a live probe

## Done Previously (Session 11, continued)

- [x] **Shipped v1.6.1** — repo replies carry branch/SHA/dirty provenance, inserted before the `DONE` sentinel so convergence detection survives (mutation-verified). Suite 41/41
- [x] **PRD v1.2** — cross-repo promoted to primary use case on Aaron's call; roadmap renumbered (v2 cross-repo → v3 remote → v4 platform); three trust-domain prerequisites named in §8
- [x] **Recorded repo-peer network isolation as deliberate** (ADR-010 amendment) — `dontAsk` denies `WebFetch`/`WebSearch`; kept so a peer can't become an exfiltration path
- [x] **Swapped the gitnexus checkout** — `tools-src\gitnexus` (main @ 1.6.9, 166 MB) replaces `Projects\gitnexus` (side branch @ 1.6.3, 1.9 GB, 867 commits stale); index deregistered, local commit saved as a patch
- [x] **Pruned the stack** — 8 windows → 6; two were zombies from the Convex-timeout cascade

## Done Earlier This Sprint (Session 11)

- [x] **Repo-resident peers** (ADR-010) — `--repo <path>` swaps reply generation for a Claude Agent SDK session rooted in that repo, at the daemon's single existing seam. Read-only by default; `--repo-bash` opts in
- [x] **`scripts/ask-agent.mjs`** — the entrance from a live coding session (subsumes most of the old `register-agent.mjs` task: register → session → send → poll is the same flow)
- [x] **Verified live cross-repo** — asked the `gitnexus` peer about the `.gitnexus\lbug` lock; 43s, four `file:line` citations, all four checked verbatim against the repo. It diagnosed the re-index failure that blocked Sessions 8-9 here
- [x] **Read the Agent SDK's real API rather than recalling it** — `allowedTools` does not restrict (only auto-approves), so read-only had to be built on `disallowedTools`. Getting this from the docs instead of memory is the reason the peer isn't write-capable by accident

## Done Previously (Session 10)

- [x] **Re-indexed GitNexus** — 443 symbols / 600 relationships / 3 flows; the `.gitnexus\lbug` lock that blocked Sessions 8-9 did not recur
- [x] **Fixed `@`-parsing over-match** — gating extracted to `src/wrapper/mentions.ts` and gated on session participants; 11 unit cases in `tests/mentions.test.ts`, mutation-verified (removing the participant filter fails 3 of them), then confirmed live in a 3-participant session
- [x] **Fixed stale turn counter** — header reads the live count off `transcript`; poll re-lists sessions every 5th tick so the sidebar and live/closed flag track
- [x] **Shipped v1.5.2** — full suite 22/22, `verify-client-stack` 5/5 with a real model reply

## Done Previously (Session 8)

- [x] **Ran `start-stack.ps1` end-to-end** — cleared a 3-day-stale stack first (Convex backend dead under a live hub), then cold-started clean; `verify-client-stack` 5/5, exit 0
- [x] **Persona demo passed** — `--print-persona` confirmed per-agent composition; live loop converged with DONE in 2 turns, bob in mentor character verbatim
- [x] **Shipped v1.5.0** (`44f647e`) — six fixes: client readiness wait, dual-family port probe, verify-script timeouts, corrected round-trip assertion, `/health` Convex probe, client honors degraded health
- [x] **Shipped v1.5.1** (`e90d461`) — `REPO_FIXER_MODEL` pointed at a model retired 2026-06-15; every `draftFix` would have thrown
- [x] **Dead `ANTHROPIC_API_KEY` replaced** — confirmed `401` on the old key, `200` on the new one
- [x] **Agent registration verified** — hand-registered `scout` completed the full flow against alice and bob

## Context

Aaron chats with agents at :5173 as the `aaron` peer. `@name` targets one agent; no mention asks the room; agent→agent replies don't cascade in group chats. Launch: `powershell.exe -ExecutionPolicy Bypass -File start-stack.ps1` (from Git Bash) — no env vars needed. Gate scripts: `demo-loop.mjs "seed" [turns]`, `verify-client-stack.mjs`.

**Registering an agent by hand:** `POST /a2a/register` with `{name, apiKey, agentCard}` and **no** auth header; everything after needs `X-Agent-Key` (any non-empty value — it is never validated). Send body is `{from, content}`; read shape is `{from, fromType, content, createdAt}`. A registered peer is typed `agent`, so in *group* sessions it must use `@name` to get a reply (ADR-007 no-cascade); in a 2-participant session, unaddressed messages always get answered.

## Success Criteria

- [x] A message containing `@anthropic-ai/sdk` does not suppress replies — live: alice and bob both answered
- [x] The turn counter tracks the transcript live without a manual refresh
- [x] `node scripts/ask-agent.mjs <peer> "question"` returns a grounded answer from that peer's repo in one command
- A message for a repo peer that isn't running still gets answered (on-demand spawn)
- Sending the same trigger twice creates one `experiences` row (dedup task)
- `docker compose --profile local up` reproduces the scripted stack (compose task)
