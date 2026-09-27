# Research 4: Telegram approval for QA runs, so the launch stops waiting on Aaron being at a machine

**By:** Scout (`sia-research`, `role: none`), 2026-09-26. **Model:** Claude Opus 5.5 (1M context). **Effort:** as
configured for this session; not independently measured.
**Asked by:** Aaron, in this session: *"How can qa be automated so I'm not the bottlneck?"*, then *"how about telegram
for approvals?"*, then *"yes"* to writing this brief (verbatim). Follows research 3 (`qa-offload.md`), where Atlas
named **launch latency** as the first constraint on QA.
**Sources:** `docs/loops/qa-queue.ps1`, `docs/loops/qa-driver-template/drive.ps1`, `docs/loops/qa-135/drive.ps1` and
`docs/loops/qa-driver-copy.mjs` on `origin/qa/bootstrap-fix-report` (READ, this session); the Telegram Bot API at
`core.telegram.org/bots/api`, Bot API 10.3 of 2026-08-24 (READ, this session).

**Labels.** **READ**: I opened the source. **TOLD**: someone else says so, or general knowledge I did not check here.
**INFERENCE**: my own reasoning.

**This is a design for the developer seat to build and the planner to rule on. Scout builds nothing.**

---

## 0. The answer in four sentences

**Aaron approves each QA run with one tap on a Telegram message; a small non-AI program on the QA machine hears the
tap and starts that one run through the existing `qa-queue.ps1`.** Aaron's approval stays per-run and his alone. What
changes is that he no longer has to be at the QA PC to give it. **The design stands or falls on six fixed rules
(section 3)**, each checked by code and each with an acceptance row (section 6). The most important: the tap is
accepted only from Aaron's Telegram account, it approves exactly one run at exactly one commit, and the run it
approves must be a byte-exact copy of the QA driver template.

---

## 1. Why the launch needs Aaron, and why this does not route around that

`qa-queue.ps1`'s header (READ): *"Aaron launches it ONCE, with the list: the list is the approval. ... The planner is
refused that launch by the host classifier, and this script does not route around it: every run in it was named by
Aaron at launch."*

**This design keeps that property exactly.** No run starts without Aaron's own act. The only change is the channel his
act travels through: a tap in Telegram, instead of typing a command at the QA PC. The planner still cannot start a
run, and nothing here lets it. (INFERENCE, and the point the planner should check hardest; `shared.md` forbids
permission laundering, and a design that let a seat's request become a run without Aaron would be exactly that.)

**What Option 2 of the chat discussion (a standing rule with no per-run approval) would be is out of scope here.**
It is a transfer of authority and is Aaron's decision on its own.

## 2. How it works

```
Atlas merges docs/loops/qa-N/  ─►  listener sees a new driver on origin/master
  (driver + dispatch, docs only,        │  checks it (rule 3.5); refuses and says why if it fails
   merged under D-032, as today)        ▼
                                   Telegram message to Aaron:
                                   "QA N · <dispatch title> · master <sha12> · ~45 min · [Approve] [Deny]"
                                        │
                     Aaron taps Approve ▼
                                   listener checks the tap (rules 3.1-3.4)
                                        │
                                        ▼
                                   qa-queue.ps1 -Queue N -Checkout <sha>   (unchanged: quiet-CPU wait,
                                                                            timeout, one run at a time)
                                        │
                                        ▼
                                   Telegram: "QA N started" ... "QA N finished: <result line from drive.meta>"
```

- **Long polling, no open ports.** The listener calls `getUpdates` with a positive `timeout`, so Telegram holds the
  request open until something arrives (READ, Bot API). Nothing listens on the network.
- **Buttons are inline-keyboard buttons whose `callback_data` is at most 64 bytes** (READ). `qa:N:<sha12>:<nonce>`
  fits.
- **The listener must call `answerCallbackQuery` after every tap**, or Telegram shows Aaron a spinner (READ).
- **One listener per bot token.** Only one program should poll a bot, since `getUpdates` confirms and forgets updates
  (READ), and two pollers conflict (TOLD, general knowledge). With two QA machines, give each machine **its own bot**,
  and name the machine in every message.

## 3. The six fixed rules (each enforced in code, never by an agent's judgment)

1. **The listener is plain code with no AI in it.** It sends messages, reads taps and starts `qa-queue.ps1`. An agent
   can cause a *message* to be sent (by merging a driver); only Aaron's tap can cause a *run*.
2. **Only Aaron's tap counts.** Each tap arrives as a `CallbackQuery` whose `from` is the Telegram user who pressed it
   (READ). The listener compares `from.id` to Aaron's numeric Telegram id, set once at install. Anyone else's tap is
   refused and logged, and Aaron is told. **The id, never the username:** usernames can change.
3. **A tap approves exactly one run, once.** The button carries the run number, the commit and a random single-use
   nonce. A nonce is spent on first use; a replayed, unknown or already-used tap is refused. **Requests expire** (12
   hours suggested); an expired tap is refused and says so.
4. **The commit must not have moved.** At approval, the listener re-reads the driver at the approved commit and
   refuses if its content hash differs from what the message offered. (The QA-102 PROBE-7 shape, T-184: the input
   changed between offer and commit.)
5. **The driver must be a byte-exact copy of the template.** Drivers are generated by `qa-driver-copy.mjs`, which
   replaces a fixed set of constants in the template exactly once each (READ): the run number, output folder,
   report path, dispatch path, stops path, completion marker and first prompt. The QA-135 driver differs from the
   template on exactly those lines, and both are 129 lines (READ, diffed this session). **So the listener regenerates
   the driver from the template plus those constants and refuses unless the result is byte-identical to the merged
   file.** This matters because `docs/**` merges need no Aaron approval under D-032, and `drive.ps1` is PowerShell
   that runs on his machine. With this rule, Aaron's tap approves a known program with known parameters. Without it,
   his tap would approve whatever code a docs-only merge put there. (INFERENCE; the strongest single rule here.)
6. **Aaron can stop everything.** A stop file on the QA machine (and a `/stop` message from his id) makes the listener
   refuse every tap and say so until it is removed. A **daily run cap** (for example 6) and a **spending note** (each
   run's `total_cost_usd` is already parsed from stream-json by the driver, READ) are reported in the finish message.

**Every decision is logged**, one line per event, beside `queue.log`: offered, approved, refused (with the reason),
started, finished, with the Telegram user id, message id, run number, commit and driver hash. GitHub's approvals
would have recorded this for free; here it has to be built, and the acceptance rows assert it.

## 4. Where the bot token lives (the weak point)

**The bot token is the bot's password.** Whoever holds it can send Aaron messages as the bot and read or swallow its
updates. **It cannot forge Aaron's tap:** `from.id` is filled in by Telegram's servers (INFERENCE from the API's
design; TOLD as general knowledge). So a leaked token lets someone **phish** Aaron with fake approval requests, or
**block** approvals, but not approve a run.

**The problem:** QA agents run as Aaron's Windows user on the QA machine, so any file that user can read, a QA agent
can read. (INFERENCE from the driver launching `claude.exe` as the current user.) Two ways to handle it, the planner
to choose:

- **(a) Separate Windows account for the listener (stronger).** A local account, say `sia-approver`, owns the token
  and a folder only it can write. On approval it writes an approval file there, which is trustworthy because of where it is; a task running as
  Aaron reads that folder and starts `qa-queue.ps1`. Aaron's account, and so the QA agent, can read the folder but
  cannot write to it, so it cannot forge an approval. **Deterministic: a file permission, not an instruction.**
- **(b) Same account, token in a file (simpler, weaker).** Accept that a QA agent could read the token. Rules 3.2 to
  3.5 still hold, so it still cannot approve a run. The residual risk is phishing Aaron from inside a QA run.
  Mitigation: every genuine message carries the driver hash, and Aaron is told never to approve a message whose run
  number he did not expect.

**Recommendation: (a).** It is one extra Windows account per QA machine, and it removes the one attack left.

**Never:** the token in the repo, in a driver, in `stops.txt`, in an environment variable a QA run inherits, or in
any message an agent can read.

## 5. What Aaron does once, per QA machine (about 15 minutes)

1. In Telegram, message **@BotFather**, send `/newbot`, name it (for example `SIA QA PC`). BotFather replies with the
   token. (TOLD: standard BotFather flow.)
2. Send the new bot any message, so the listener can learn his numeric id on first run and ask him to confirm it.
3. Create the `sia-approver` Windows account (if option (a)), and put the token where the developer's install script
   says. This is a security setting on his machine, like the Defender exclusions in T-190, so **he does it himself.**
4. Register the listener to start at boot (a scheduled task, set up by the install script).

## 6. Acceptance rows (a ruling with no row fires nowhere)

Each row is a test, red first against the code without the guard, and killed by a mutant that removes the guard
(`shared.md`). Mocked Telegram responses are fine for all of them; one live smoke test with Aaron's real account
closes the loop.

| Row | Given | Expect |
|---|---|---|
| TA-1 | tap with `from.id` not Aaron's | refused, logged with the id, Aaron told; no run |
| TA-2 | the same tap delivered twice | first starts the run, second refused as spent |
| TA-3 | tap after the expiry | refused as expired; no run |
| TA-4 | driver content changed between offer and tap | refused, both hashes logged |
| TA-5 | driver differs from the template by one byte outside the constants | never offered; Aaron told why |
| TA-6 | a constant contains a `'`, or the run number is not digits | never offered (`qa-driver-copy.mjs`'s own refusals, reused) |
| TA-7 | stop file present | every tap refused and says so; removing it resumes |
| TA-8 | daily cap reached | tap refused, cap named |
| TA-9 | approved run | `qa-queue.ps1` invoked with exactly `-Queue N -Checkout <sha>`; the started and finished messages sent |
| TA-10 | the token | absent from the repo, the driver's environment and every log line (a scan, validated against a planted positive) |
| TA-11 | every path above | exactly one log line per event, carrying user id, run, commit and hash |
| TA-12 (if 4a) | a process running as Aaron's user writes an approval file | the write is denied by the folder's permissions |

## 7. Not in this brief

- **Atlas's questions to Aaron by Telegram.** The same bot could carry them (the D-038 channel: Aaron speaks only
  to the planner, and this would be the planner's way to reach him). It is a separate design: it carries free text
  from an agent, not a yes/no on a checked artifact. Worth a brief of its own.
- **A standing rule with no per-run approval** (section 1). Aaron's decision alone.
- **EC2** (research 3). This design runs unchanged on an EC2 Windows machine, with its own bot.

**What would change my mind:** if Aaron would not in practice tap faster in Telegram than in the GitHub app, GitHub
environment approvals (a required reviewer on a self-hosted Windows runner) give rules 3.2, 3.3 and the audit log for
free, and only rule 3.5 would need building.
