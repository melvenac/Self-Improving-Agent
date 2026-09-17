# Runbook

## Developer Installation (working on this repo)

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
cd open-brain && npm install && npm run build
```

`open-brain/` is the only npm package in the repo; `scripts/` holds a single
standalone `setup.mjs` with no dependencies of its own. Node v22 LTS — v24
breaks the Smart Connections Obsidian plugin.

## User Installation

```bash
node scripts/setup.mjs          # --dev symlinks instead of copying
```

Installs slash commands to Claude Code (`~/.claude/commands/`) and Cursor
(`~/.cursor/commands/`), registers the open-brain MCP server in both, and wires
the SessionStart hooks. Re-run after pulling to update. README.md is the
authoritative walkthrough.

## Hook Configuration

Two hooks, both compiled TypeScript under `open-brain/build/`. Build before
registering them. Registered in `~/.claude/settings.json` (and
`~/.cursor/hooks.json` for Cursor):

| Event | Command | Does |
|---|---|---|
| SessionStart | `node <repo>/open-brain/build/cli-bootstrap.js` | Emits `SESSION_UUID` and agent identity. (The mailbox line it used to emit went with the transport in Loop 12.) Exits silently inside a subagent (anti-loop). |
| SessionEnd | `node <repo>/open-brain/build/cli-session-end.js` | Summary → auto-feedback → invocation logging → shadow recall → topics. |

There is no ordering constraint: one hook per event, and each pipeline sequences
its own stages internally. `checkHookRegistration` fails `/sync` on a duplicate
registration — separator spellings differ between installs and a naive dedup
once created two SessionStart entries that both fired.

**Cursor requires PowerShell as the shell on Windows.** Cursor wraps hook
commands in PowerShell syntax; a bash default kills them on `&` before node
runs, and SessionStart fails silently.

## Required Vault Structure

`~/Obsidian Vault v2/` — resolve it via `obsidianVaultDir()`, never by re-joining
the literal. Overridable with `OPEN_BRAIN_VAULT_DIR`.

```
~/Obsidian Vault v2/
  Experiences/       # Lessons learned, NESTED under project subdirectories
  Summaries/         # Enriched session summaries
  Checkpoints/       # /checkpoint captures
  Skills/            # Approved skills
  Skill-Candidates/  # SKILL-INDEX.md + SKILL-CANDIDATES.md (was Guidelines/)
  Archive/
```

**`Experiences/` is nested, not flat.** A flat `readdir` reads 1 of 399 notes and
reports "0 clusters" rather than failing. (The skill-scan runner and its test were cut in Loop 10.)

The v1 `~/Obsidian Vault/` still exists as a read-only archive. Nothing writes to
it; a path pointing there resolves to real, stale data, which is why the
distinction has to be checked rather than assumed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No session captured after session ends | Hook not registered, or not rebuilt | Check `~/.claude/settings.json` for a SessionEnd entry pointing at `open-brain/build/cli-session-end.js`, and confirm the file exists — an unbuilt repo registers fine and fails silently |
| Session-end errors on run | Missing vault directories | Create the structure above under `~/Obsidian Vault v2/` |
| `ob_recall` returns nothing | open-brain MCP not running | `claude mcp list`, verify `open-brain` is present |
| `ob_recall` returns nothing for a multi-word query | Precise FTS5 query underfilled | Expected: it retries OR-joined and labels the broadened rows. If still empty the server is stale — rebuild and restart |
| An `ob_*` tool ignores a parameter you just added | **MCP server loaded its build at process start** | Restart the MCP server. zod strips unknown params silently, so the call *succeeds* and the value vanishes. Until restart, trust `node open-brain/build/cli.js` over the `ob_*` tools |
| Smart Connections returns nothing | Vault not indexed | Open Obsidian, let Smart Connections re-index. Node v24 breaks the plugin — stay on v22 LTS |
| Paths mismatch on Windows | Separator/case variants | `canonicalizeProjectDir()` in `shared/paths.ts` normalizes at write and query boundaries — check for hardcoded separators rather than re-normalizing at the call site |
| `gitnexus analyze` exits 1 with `file_fts is inconsistent` | Corrupt FTS index in GitNexus's own graph DB, usually left by an interrupted incremental run | `node .gitnexus/run.cjs analyze --repair-fts`, then re-run `analyze`. The re-run finds the aborted run's `incrementalInProgress` flag and forces a full rebuild on its own (~20s), so a "success" here is a full rebuild, not an incremental one — check the output says so. |

**Always run `gitnexus analyze` in the foreground and check `$?` separately.** Piping it through `tail` prints a healthy-looking banner while masking a non-zero exit, and running it backgrounded while editing files fails on a session lock. Both failures write no database and report success. (Sessions 41, 48)

## Logs and telemetry

All under `~/.claude/open-brain/`:

| File | Written by | Holds |
|---|---|---|
| `knowledge-v2.db` | everything | The knowledge base. Override with `KNOWLEDGE_V2_DB` |
| `active-session.json` | `cli-bootstrap` | Session UUID handoff, keyed `<project>::<ide>` — how Cursor passes the UUID, since it does not inject SessionStart stdout |
| `skill-invocations.jsonl` | session-end Stage 4 | Which skills actually get used |
| `score-history.jsonl` | `sync --score` | Protocol health score over time |
| `shadow-recall.jsonl` | shadow pipeline | Ranking-strategy evaluations |

The v1 `~/Obsidian Vault/.vault-writer.log` has had no writer since 2026-04-16.
It still exists and still contains data, which is exactly why it reads as live —
do not diagnose against it.

## Working Cadence

Sessions 1–36 ran ~1.5/day (2026-03-23 → 2026-04-17). Sessions 37–40 ran ~1/month
(gaps of 21, 25, 30, 25 days). The process was built for the first cadence and
silently degraded under the second: 7 tests rotted for 3.5 months, v0.7.1 stayed
tagged-but-unpushed, the PRD drifted 3 versions, and score history stopped
collecting — none of it noticed, because noticing depended on working daily.

At monthly cadence, memory between sessions is the bottleneck, not throughput.
What follows assumes you will not remember the last session.

**Mechanical checks replace remembering.** Every recurring failure in the session
logs was something a check could have caught:

| Recurred | Sessions | Now caught by |
|---|---|---|
| distribution/mirror drift | 12 | `checkMirrorParity` |
| SESSION_UUID wiring | 10 | `cli-bootstrap.test.ts`, `checkHookRegistration` |
| stale paths after retirement | 8 | `resolveDocPath`, `/sync` warnings |

Prefer adding a check over adding a note. A note is read once; a check runs every
time.

**Start of session:** run `/sync`. It is the cheapest way to learn what drifted
while you were away. Read `.agents/SESSIONS/next-session.md` before anything else.

**End of session:** leave the tree committable. Uncommitted work is the single
biggest cost of long gaps — Session 38's Cursor work sat uncommitted for two
months and required re-verification before it could land. If work is not
finishable, commit it on a branch rather than leaving it in the working tree.

**Close verification loops in the same session that opens them.** "Verify next
session" survived ten sessions for SESSION_UUID. If it cannot be verified now,
write the test that will verify it automatically instead.

**Session logs are write-once.** 153 open checkboxes have accumulated across 42
logs; none were ever closed in place. Track live state in
`.agents/TASKS/INBOX.md` only, and treat logs as an append-only record.
