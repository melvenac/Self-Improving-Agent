# Session 14 — 2026-09-20 / 21

> **Objective:** Started as "why can't four Claude Code sessions talk to each other." Became: fix the hub transport silently dropping turns, close all three v2 trust-domain prerequisites, and recover from a split-deploy outage.
> **Status:** Completed
> **Shape:** Clark (Claude Code, planner, ran from `~`) + a Cursor Grok 4.6 agent (implementer, in this repo), coordinating over a hub room with no human relaying messages. Atlas (SIA planner seat) consulted; a Grok bot joined as a third vendor.

---

## Work Log

### What was done

**The hub transport was losing messages.** `hub-talk.mjs` advanced the reader's cursor on a `--say`, so a peer turn that arrived *before* your send was never delivered. Two real turns vanished in two seat rooms in one afternoon, and the QA seat hit the same defect independently. Fixed by making the cursor a **turn number that only a print moves**: `convex/messages.ts:list` numbers turns by position and accepts `after` beside the legacy `since`; `--say` never touches the cursor.

**All three v2 trust-domain prerequisites closed** (PRD §8):
- **§8.1 `X-Agent-Key` validation** — `src/auth.ts` was written in an earlier session and left uncommitted. It was complete and correct; the missing piece was tests. Landed with them.
- **§8.2 name ownership (partial)** — ADR-011. Identity is `apiKeyHash`; instance supersede via `instanceId` for long-lived daemons.
- **§8.3 ask policy** — ADR-012. Optional `askPolicy`, absent means allow-all.

**A split-deploy outage** (see below) and the runbook written to prevent a recurrence.

**Cross-vendor agent communication proven.** A Claude Code session and a Cursor Grok 4.6 agent held a working two-way conversation over the hub, including the implementer correcting the planner's design twice. A third vendor (a Grok bot) registered and conversed, but from Aaron's desktop — it could not reach the tailnet from its own host, so genuinely remote participation is **not** proven.

### Files created
`scripts/hub-cursor.mjs`, `scripts/hub-rooms.mjs`, `src/identity.ts`, `src/ask-policy.ts`, `convex/instanceLogic.ts`, `tests/hub-cursor.test.ts`, `tests/hub-rooms.test.ts`, `tests/hub-talk.cli.test.ts`, `tests/auth.test.ts`, `tests/identity.test.ts`, `tests/ask-policy.test.ts`, `docs/joining-the-hub.md`, `docs/redeploying-tcm.md`, `.agents/SESSIONS/HANDOFF-auth-and-a2a-transport.md`

### Files modified
`scripts/hub-talk.mjs`, `convex/messages.ts`, `convex/agents.ts`, `convex/schema.ts`, `src/index.ts`, `src/agent-card.ts`, `src/wrapper/daemon.ts`, `src/task-store.ts`, `src/a2a-executor.ts`, `convex/a2aTasks.ts`, `Dockerfile`, `CHANGELOG.md`, `DEPLOY.md`

### Outcome
**v1.7.0 tagged and deployed to tcm.** Tests 40 → 84. 17 commits pushed.

---

## Gotchas & Lessons Learned

**A hub redeploy is TWO deploys, and the Convex functions go first.** The outage: the `a2a-hub` container was rebuilt from current master while the `convex` container had been up seven hours untouched. The new app called `agents.getByName`, `agents.getByKeyHash` and passed `?after=` to `messages.list` — none of which existed on the backend. Sends and registers 500'd; heartbeats and unfiltered reads kept working, so it presented as partial rather than down. Convex-first is safe (the old app never calls what it doesn't know about, and additive args are optional); app-first is what broke. Full runbook: `docs/redeploying-tcm.md`.

**`/health` cannot catch version skew and did not.** It returned `200` with `convex.latencyMs: 2` throughout the outage, because it probes `peers.list`, whose signature never changed. Any post-deploy check must exercise a signature that *changed*.

**There was no rollback image.** `a2a-hub:latest` had been overwritten with no tagged or dangling predecessor. Tag the outgoing image before replacing it.

**Verifying against "the old version" can prove the wrong thing.** The turn cursor was verified against an un-redeployed hub and reported backward compatible. That hub was old-app *and* old-Convex, which silently **ignored** the unknown `after` argument. The split state — new app, old Convex — **rejects** it and takes every filtered read down. The benign half was tested and the general case asserted. `bfeb9fa` makes the client degrade gracefully, which it should have done from the start.

**Client mitigations propagate for free.** Every agent runs `hub-talk` from the working copy, so pushing `bfeb9fa` self-healed a *different vendor's* agent in ~31s, ten minutes before the backend was repaired.

**Delivery is not wake-up, and wake-up is harness-specific.** Claude Code re-invokes a session when a background process exits; the Cursor agent took ~8 minutes on the same signal. The hub can guarantee delivery; it cannot guarantee anyone acts. Push would not fix this.

**Two agents in one working tree collide.** `src/index.ts` held ~120 lines of another session's uncommitted work in the same hunks as a 2-line change, which could not be staged separately. Check `git status` before assuming a file is yours.

---

## Decisions Made

- **ADR-011** — name ownership (§8.2 partial) and daemon instance supersede. *Supersede, not reject*: the observed failure is a restart leaving an orphan, so the newcomer must win or a restart silently never takes.
- **ADR-012** — ask policy as an §8.3 concept, not an engine. Absent `askPolicy` = allow all, so no warn/strict twin is needed: setting a policy *is* the opt-in.
- **ADR-013** — ambiguous silence must fail closed. Five defects in one session, found five ways by four parties, are one class: a mechanism that looks healthy while losing information.
- **Declined:** putting the Grok bot's host on the tailnet. Brian will never be on Aaron's tailnet, so an agent needing private network access is v2 with extra steps. Network-level access standing in for application-level auth is exactly what v3 replaces.
- **Deferred:** long-poll, re-weighed by Atlas from load reduction to **correctness** after the Grok bot's framing — *"so that 'nobody was listening' cannot silently look like a healthy empty room."*

---

## Post-Session Checklist

- [x] Session log completed
- [x] SUMMARY.md updated
- [x] DECISIONS.md updated (ADR-011, 012, 013)
- [x] ENTITIES.md updated (`askPolicy`, instance fields)
- [x] INBOX.md updated
- [x] Suite green (84/84), `tsc --noEmit` clean

---

## Next Session Recommendations

1. **Verify revocation against the live database.** The one unmet condition gating public exposure. `register` collapses duplicates and deletes extras, but only ever in tests; the live DB held ~39 historical agent rows each carrying its own `apiKeyHash`, and the collapse is capped at 4000 deletes per call. If stale rows survive, a **superseded key still authenticates**. Read-only investigation first — do not improvise fixes against live data.
2. **Then the remote-agent milestone:** per-agent keys (removing `daemon.ts`'s `dev-key` fallback) → soak the warn logs → `AUTH_MODE=strict` → expose over HTTPS → the Grok bot registers from its own host. This is the v3 premise actually proven. The keys-and-strict step is where a mistake logs out every agent at once, including the rooms that would carry the message about it — it wants a clear head and a rollback plan.
3. **Then on-demand spawn** — the biggest functional leap left in v2, and per INBOX what genuinely retires the file mailbox.

**Before starting:** Cursor may still be live in this repo. Two agents in one tree collide — decide who owns it, or scope them to disjoint files.
