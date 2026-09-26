# Next Session Handoff

> Updated at end of Session 13 (2026-08-07). Relay baton, not a log.

## Session 13 addendum — read first

**Session 13 changed no A2A-Hub code.** It was Buzz research plus a blocked VPS deploy.
`git status` ended byte-identical to how it started. Everything in the Session 11 handoff
below is therefore **still unstarted and still current** — start there.

Three things carried out of Session 13:

1. **The VPS is unreachable until you make a call on a host key change.** `myvps`
   (172.86.123.176) now presents **all three** host keys different from `known_hosts`:

   | | stored | now |
   |---|---|---|
   | ED25519 | `pyTJRr+XGbkJhFB1YDpqjkBlWc6FtcEUihVhDplUdoM` | `IZGWtPpjtlwqdH7OkLy0gP6F/Fyoxn2uJ3xLfh/R/xM` |
   | RSA | `IWVX1pAGD+sGmW0+21VT0u44qJXWWA9TRGig4n/lujM` | `c8cOD0Swjf3hM4Aw9WY886jiuwwbX4sJIY45ZtM6q/M` |
   | ECDSA | `bBsEd0Na2VEabkM62qhjoH+LyingNAKqCxEjNPwBlOs` | `XlwRFehsuS5XvQ+QbceX4HxMiBuXJT3zZIDNZnoZ7pY` |

   All three changing together points at a rebuild or IP reassignment (Aaron has several
   neighbouring IPs from the same provider in `known_hosts`), but that is indistinguishable
   from interception client-side. **Nothing was connected to and `known_hosts` was not
   modified.** Confirm the fingerprint via the provider/serial console, then
   `ssh-keygen -R 172.86.123.176` and reconnect. This blocks *any* VPS work, not just Buzz.

2. **Buzz is parked** — Aaron's words: "I will look at Buzz another day." Full write-up in
   `.agents/RESEARCH/buzz-nostr-agent-workspace.md`, including why it can't run locally on
   Windows and the Caddy-vs-Traefik caveat for the VPS bundle. Clone is at
   `C:\Users\melve\Projects\buzz` (outside this repo). Open Brain entry id 344.

3. **`Session_12.md` is a stale stub** — dated 2026-07-30, still "In Progress", template
   placeholders unfilled, and its `.recalled-entries.json` (session `30f8a7ae…`) is still
   sitting in the repo root. Session 13 logged separately rather than overwrite it. Someone
   should either fill it in from memory or mark it Abandoned. The stale
   `.recalled-entries.json` will also mislead the next `/end`'s knowledge-feedback step.

---

> Session 11 handoff follows, unchanged and still current.

> **Priority changed at the end of Session 11 (Aaron's call).** Cross-repo agent-to-agent is now the **primary** use case with its own roadmap phase (PRD v1.2: v2 cross-repo → v3 remote/Brian → v4 platform). Reasoning: same protocol at a shorter distance, and the only version verifiable without a second person in the loop. The catch he agreed with: one machine has one trust domain, so auth, peer identity, and authorization are invisible locally and load-bearing remotely — PRD §8 now names all three as v2 *prerequisites*, not later hardening. Items 2-4 below exist because no cross-repo test can ever fail on them.

## Pick up here

1. **Two cheap experiments on repo-peer auth and model cost (Aaron asked for these first).** Both are measurements, neither commits to anything.

   **(a) Does the peer authenticate without an API key?** Today's probe proved `init.apiKeySource: ANTHROPIC_API_KEY` — the peer bills metered API spend, because the daemon launches `node --env-file=.env` and `.env` holds `ANTHROPIC_API_KEY`, the highest-precedence credential. Credential resolution is `ANTHROPIC_API_KEY` → `ANTHROPIC_AUTH_TOKEN` → OAuth profile → default profile, and the Agent SDK honors the same resolution Claude Code does. **Test:** launch the repo-peer daemon *without* `--env-file=.env` and see whether `apiKeySource` changes or it fails to authenticate. Note `ant` is NOT installed, so there is no `~/.config/anthropic` profile — it would have to pick up Claude Code's own `/login` credential, which is unverified. **Do not make this the default on a passing test:** whether subscription auth is appropriate for an always-on daemon serving automated requests is a terms question, not a technical one, and it needs Aaron's read of his plan. Also a real tradeoff — the API key gives `maxBudgetUsd` enforcement and per-reply cost visibility; subscription auth would fail as *throttling mid-answer* instead of the clean `error_max_budget_usd` message that made the cap mis-sizing visible today.

   **(b) What does Sonnet 5 cost on a lookup?** The peer currently runs **Opus 5** (`claude-opus-5[1m]`), not haiku — `WRAPPER_MODEL`/haiku is the alice/bob Messages API path and the repo peer never touches it. A probe with *every tool denied* and the prompt "reply with exactly: ok" cost **$0.099**, so ~$0.10 is the per-turn floor. `REPO_AGENT_MODEL` is the existing knob. **Test:** run the same lookup question under Opus 5 and Sonnet 5, compare cost, latency, and citation accuracy. Likely outcome is Sonnet for routine lookups and Opus for scoping — but measure before splitting.

2. **On-demand spawn.** A repo peer only answers if its daemon is already running. The hub should see a message for a repo peer with no live registration, launch a headless agent rooted at that repo, take the answer, and let it exit. Zero idle cost, no N-daemons-polling problem — and this is the piece that actually *retires* the file mailbox rather than out-competing it. Everything else in the ask path already works.
2. **Validate `X-Agent-Key`** (PRD §8.1). Presence-only checks; a bogus key returns 200. `apiKeyHash` is already stored at registration and never compared, so this is close to a one-function fix. Do it *now*, while it feels pointless — that's the whole argument. Note `ask-agent.mjs` registers ephemeral peers freely, so the surface just widened.
3. **Namespace peer identity by owner** (PRD §8.2). Bare names collide the moment a second machine also runs a `gitnexus` peer. Cheap before two machines exist, a migration after. Keep it invisible locally with a default.
4. **"Who may ask this peer what"** (PRD §8.3) — the concept, with a permissive local default. Read-only (ADR-010) narrows the blast radius but doesn't answer who may ask. Later policy should be filling in a value, not introducing a layer.
5. **Give repo peers git history.** Bash is denied by default (it's the trust boundary), so the peer can't answer "when did this change and why" — arguably what a repo expert should be best at. A scoped allow rule (`Bash(git log *)`, `Bash(git show *)`) keeps the boundary. Per the Agent SDK docs, a scoped rule leaves the tool available and denies non-matching calls in every permission mode.
6. Carried, now v3: experience dedup (forge-to-atlas.md §triggerHash), docker-compose profiles.

## Watch out for

- **Repo peers fabricate citations sometimes — check every path before acting on one.** Across four verification passes in Session 11 the `gitnexus` peer was exact three times (the lbug lock diagnosis 4/4, the version answer, a correct "no, this repo has no Stripe integration") and wrong once: it cited `gitnexus/src/cli/commands/mcp.ts` (real path `src/cli/mcp.ts` — it invented a `commands/` segment) and cited `package.json:17` as a command registration when line 17 is inside `"keywords"`. **A real line number attached to a wrong claim is the failure shape to fear** — it survives a casual glance. The provenance footer tells you which *checkout* answered; it says nothing about whether a citation is real. Weak correlation worth watching: the exact answers came from specific questions and took ~40s; the fabricated one came from "name one file…" and took 18s.
- **Which checkout a repo peer should read depends on the question, and it can't be both.** The `gitnexus` peer reads `main`, which is **353 commits ahead of the published v1.6.9** that Aaron actually runs (a clone's `package.json` reads the last released version, so "1.6.9" in the tree does NOT mean it equals the 1.6.9 tarball). That is right for *"how would I fix this upstream?"* — you patch and PR against main — and wrong for *"why does my installed binary behave this way?"*, which needs the release tag. Concretely: the peer cited `gitnexus-hook.cjs:524` from main's 552-line file while the installed hook is 502 lines. Neither reading was incorrect; they answer different questions. If both matter, run two peers (`gitnexus-main` and `gitnexus-release` on a `--branch v<version>` clone) rather than trying to make one checkout serve both.
- **`gitnexus setup` DOES refresh the hook script** even when it prints "hooks (already configured)" — that message refers only to the `settings.json` registration, which it correctly leaves byte-identical. Session 11 re-ran it and the hook went 268 → 502 lines. Back up `~/.claude/settings.json` first anyway; `setup` writes to global config across every detected editor unless scoped with `-c claude` (valid ids: `cursor`, `claude`, `antigravity`, `opencode`, `codex` — **not** `claude-code`).
- **The `gitnexus` peer now reads `C:\Users\melve\tools-src\gitnexus`** (main @ 1.6.9), not `Projects\gitnexus` — that folder was deleted in Session 11 (1.9 GB → 166 MB, stale side branch 867 commits behind main, and its version disagreed with the installed CLI). Its one local-only commit is preserved as `C:\Users\melve\tools-src\0001-chore-agents-*.patch`. The stale GitNexus index was deregistered with `gitnexus remove --force`. **The clone and the global npm install still have no link** — `npm i -g gitnexus` and `git pull` are unrelated, so drift will recur; the provenance footer makes it visible, not fixed.

- **`allowedTools` in the Agent SDK does NOT restrict the agent to that set** — it only auto-approves; unlisted tools fall through to `permissionMode` and `canUseTool`. Read-only is built on `disallowedTools`, which is the only option that actually removes a tool. If someone "simplifies" `repo-reply.ts` to an allowlist, the peer becomes write-capable with no visible change. There's a test on `resolveDisallowedTools` guarding exactly this.
- **`permissionMode: "dontAsk"` is load-bearing, not a preference.** A daemon has nobody to answer a permission prompt, so any mode that prompts would hang the reply forever rather than erroring. `dontAsk` denies instead.
- **`settingSources: ["project"]` is deliberate.** Omitting the option loads user + project + local — which would pull Aaron's global `CLAUDE.md` and context-mode routing rules into a peer answering about someone else's repo. Project-only gives the repo's own conventions without the operator's.
- **Repo replies cost real money and take ~40s.** `maxBudgetUsd` defaults to $0.50 and `maxTurns` to 12 — deliberately an order of magnitude above the hub's other budget caps (classifier 50 tokens, repo-fixer 2000), because a repo peer isn't a classifier. If cost surprises, that's the dial. The SDK's `startup()` warm-query helper is the latency lever.
- **The GitNexus lock mystery is solved** — by the gitnexus peer itself, in the live test. `gitnexus/src/core/run-analyze.ts:262-272` deletes the lbug files and **swallows every failure** (`catch { /* swallow */ }`), so a Windows sharing violation is silent; `initLbug` at line 272 is what surfaces it. `withLbugDb` retries on busy, but `initLbug` from the analyze entry point does **not**, so an analyze racing a live MCP server fails on the first lock hit. Practical rule: stop `gitnexus mcp`/`serve` before `analyze`, or delete a stale `.gitnexus/lbug.lock` if nothing holds the handle. (Session 10's re-index succeeded with the servers running — consistent with this: the pooled read-only handles just weren't open at that instant. It's a race, not a hard block.)
- **The Convex window is titled `C:\Windows\system32\cmd.exe`, not `A2A Convex`.** `npx` shells through `cmd.exe`, which overwrites the title after `start-stack.ps1` sets it. This is the most load-bearing window in the stack wearing the most disposable-looking name — close it and the hub goes `503 degraded` while every write fails, which is the Session 8 three-day outage. **Identify windows by their live node child, not by title.** Filed in INBOX.
- **`start-stack.ps1`'s 120s Convex wait is too short from cold**, and the failure cascades — Convex never binds :3210, the script continues, and the daemon windows die with it, leaving a `503 degraded` hub and verify failures unrelated to the code under test. Recovery: `npx convex dev --local --once`, then a persistent Convex window, wait for the port, then `start-stack.ps1 -SkipBuild`.
- **`Stop-Process` on a daemon window does NOT kill the daemon.** The node child is orphaned and keeps polling. Restarting a peer this way gives you *two* live daemons for one name, both answering, and `repliedTo` is per-process so nothing dedupes them — in Session 11 a stale build answered a question after what looked like a successful restart, which is how a missing feature appeared to be broken code. **Kill the node PID, not the window** (`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like "*--name <peer>*" }`), or kill both. Filed as a hub-side fix in INBOX.
- **Dead A2A windows accumulate.** `-NoExit` keeps a window alive after its node process dies, so a cascade leaves empty shells and a re-run stacks new windows beside them (Session 11 ended with 2 zombies of 8). To audit, map live node processes to `ParentProcessId` and compare against `Get-Process powershell | ? MainWindowTitle` — and check for a **node** child specifically, since every console window has a `conhost.exe` child and "has any child" always matches.
- **Minimum stack is 3 windows:** Convex + Hub + the repo peer you're testing. The client (:5173) is only for the chat UI, and alice/bob are only for the agent↔agent demo — neither is needed to test a repo agent.
- **GitNexus does not index `.svelte`** — `impact`/`context` return "not found" for `client/src`. Coverage gap, not a safe result.
- **`.ps1` files must stay ASCII-only** — PS 5.1 reads BOM-less files as ANSI; em-dash bytes decode into smart quotes that terminate strings.
- **`X-Agent-Key` is never validated** — now a v2 prerequisite (item 2 above), not background debt. The trap is that it will keep feeling like debt, because nothing on one machine fails without it.
- **Test peers accumulate** — `scout` (S8), two mention-check sessions (S10), plus `gitnexus` and an `ask-<pid>` peer from this session. Harmless; delete if they clutter.
- **`.env` holds Aaron's real `ANTHROPIC_API_KEY`** — gitignored. The Agent SDK resolves credentials itself (env or the `ant`/Claude Code profile), so a repo peer may work even where the daemon's Messages API path would 401 — don't read a working repo peer as proof the key is good.
- Aaron launches from **Git Bash** — `.ps1` needs `powershell.exe -ExecutionPolicy Bypass -File start-stack.ps1`.
- DONE sentinel still leaks: any message *ending* with "DONE" reads as a sign-off.
- **Atlas mailbox is stale** (last message 2026-04-26). Atlas is inactive — don't block on it.

## Open questions

- ~~Store-and-forward or synchronous ask first?~~ **Resolved Session 11** — synchronous ask, because it strictly dominates: hub messages already persist, so a message left for an offline peer *is* store-and-forward once the ask path exists.
- Should the entrance be an MCP server on the hub (`a2a_ask(peer, question)`) rather than a script? Cleaner, and fits how Aaron already works with 8 MCP servers registered. But ADR-006/007 already superseded an MCP channel layer once — re-read that reasoning before reviving it. The two aren't the same thing (MCP-as-transport vs MCP-as-entrance for a coding agent), but the prior rejection deserves a look.
- How should a repo peer be named and discovered? Currently the name is hand-passed (`--name gitnexus`). A registry mapping repo path → peer name would let `ask-agent.mjs` take a path instead of a name.
- Should `/health`'s 503 also cover the Anthropic API, or is Convex the only dependency worth gating on?
- Session delete: hard delete with message cascade, or archive-only?
