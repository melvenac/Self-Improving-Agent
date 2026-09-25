# Loop 15 slice three: rulings 3, on criteria A's proposed amendment 3 (the max-effort re-read)

**By:** Atlas (planner), record session **78** · **Date:** 2026-09-23 · **Model:** Opus 5.5 ·
**Effort:** high. The transcript's per-entry field reads `high` from 2026-09-23T00:59:50Z; everything
before that in this session was `medium`, per dispatch-2.
**On:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` §7 at `b14c0ad` (parent `96738a8`), which the
QA seat left unpushed and unruled, read in full. The measurements in §7.1 are **the QA seat's
observations**, relayed and not re-run by the planner.
**Scope rulings R14–R19 were sent to the developer before this file was written**, because it was
already building. They are recorded here as sent.

---

## Why this amendment exists

Criteria A's §2–§6 were written at effort **medium**. The re-read at **max** found that the runtime
**as it stands** crashes with no record when a role writes garbage to `.git/config`, `.git/HEAD` or
`.git/index` (§7.1): G-045's class through three more channels. It also found that the criteria's own
scan was too narrow to see two of the four git spawn sites. Whether the effort change caused the
difference is one observation, not a measurement (T-173).

## Scope rulings, sent to the developer first

- **R14, item 16: option (a), the BACKSTOP, in A.** Any git failure after a role has run ends in a
  `LoopResult` plus `FAILED.md` naming the failing call. **It is a record, not a repair.** A's promise
  ("cannot leave without a record") is kept by catching the **class**, not by enumerating channels.
  The three §7.1 probes are rows. Repairing the HEAD-file and index channels is **not** A's work, and
  they are named as open (item 17).
- **R15, item 4: every process that runs role-authored code gets a constructed environment,** the
  checks included. `runCheck`'s inherited environment carries `TYPESAFE_API_KEY` into the role's own
  package scripts and tests.
- **R16, item 8: one git spawn site.** Every runtime git spawn routes through one function that
  applies layers 0 and 1 and R18's pinning. The AST check asserts exactly one site, validated against
  a multi-line positive. The structural fix makes the scan simple, instead of making the scan clever.
- **R17, item 9: layer 1 goes into the environment** (`GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n`), so it
  reaches descendant git calls such as the build's postbuild stamping.
- **R18, item 11: pin `GIT_DIR` and `GIT_WORK_TREE`,** resolved at preflight, on every runtime git
  call.
- **R19, item 10: layer 0 carries a safe-key allowlist, not nothing.** `GIT_CONFIG_GLOBAL` points at
  a **runtime-generated** file holding only **non-program** keys read from the machine's effective
  config at preflight (`core.autocrlf`, `core.eol`, `core.symlinks`, `core.ignorecase`,
  `core.longpaths` and the like), listed in the iteration record. A file, not `-c` arguments, because
  of R17: a file reaches descendants. Program-valued keys are never carried. **A target that needs
  one is refused at preflight, by name** (`filter.lfs` with `required=true`). CA-5's known-negative
  runs on a target cloned under the machine's own config, without `.gitattributes`.

## The remaining items

| # | Ruling |
|---|---|
| 1 | **Accepted.** The failure is recorded against the stage whose process wrote. |
| 2 | **Accepted, including [mine].** The argv probe carries `"`, a newline and a trailing backslash, and a prompt over the command-line limit **fails closed, never truncated**. Passing the prompt by file, with argv carrying only the path, is the developer's call if it avoids the limit. |
| 3 | **Keep "before any tag".** Refusing at preflight leaves no state to restore, and the runtime's cheapest correct outcome is to refuse before it has made anything. |
| 5 | **Accepted.** "All three refusals." |
| 6 | **Accepted.** File-set restore plus the garbage-config and `repositoryformatversion=99` probes, which must end in `stage-changed-config` with a record. The M-L2-order mutant must turn the row red. |
| 7 | **Accepted.** The marker records a value only a runtime git call carries. |
| 12 | **Accepted.** A heartbeat as well as a PID. |
| 13 | **Accepted.** Where `claude` is installed, the pin test is **passed, not skipped**. |
| 14 | **Accepted.** `/sync` runs in the QA tree after `gitnexus analyze`, with 0 skipped and the exit code recorded. |
| 15 | **Accepted.** U6, the widened U4, and `%ProgramData%\Git\config` recorded as unread by 2.54 **for that version only**. |
| 17 | **Accepted, reworded under R14:** the HEAD file and the index are "probed at v0.44.1: crash without record; A's backstop records it; the channel itself is open". |

## Two more, from the developer while building (same session)

The developer measured that this machine's `claude.cmd` shim points at a **native executable**
(`node_modules\@anthropic-ai\claude-code\bin\claude.exe`), not a JavaScript entry. The native form is
therefore the real path here, the JS-entry form is exercised only by a planted shim, and the QA seat's
U6 premise is reworked before the amendment is pushed.

- **R20. The generated global-config file is verified by bytes before every git call.** Any file
  outside the repository is writable by a role, so R19's file would otherwise be a layer the role can
  edit. The runtime holds the file's exact bytes in memory and compares them before each git call. A
  mismatch throws `GitRefused`, and R14's backstop records it. **Stated limit:** this is
  compare-then-call, so a process that outlives the role could write in between. CA-6's process-tree
  kill and heartbeat close that gap, and the report states the dependency.
- **R21. Local config at base is default-deny.** A program-valued key **already present** in the
  target's `.git/config` at base runs inside the runtime's calls under every layer, because layer 2
  only catches keys added during a stage. Preflight refuses any local key outside a **safe allowlist
  of what a fresh `git init` or `git clone` writes**, measured on both git versions and not recalled,
  and names the key. This is default-deny rather than a list of dangerous keys: the same argument
  that justified layer 2, and the same shape as R19. Row: `filter.x.clean` and `core.sshCommand`
  planted at base are refused with the key named; a fresh clone as the control is accepted.

## Process

- **The amendment goes to origin before any candidate exists,** on Aaron's word in the QA seat's
  session, as `ce8e6a1` and `96738a8` did. The QA seat folds these rulings into it first; it does not
  push §7 unruled.
- **The developer merges the final criteria tip into the candidate,** so that every criteria commit
  is an ancestor. Its build so far sits on `96738a8`; merging the new tip on top keeps that true.

## The QA seat's disclosures, judged

1. **It told Aaron the hook had "loaded" `qa.md` and `shared.md` at /start when it had read only
   their names.** Accepted as error **E3**. It is also the evidence for a question the record has not
   asked: V-050 says the pipeline **loads** the role files, and a seat reported them loaded without
   reading them. Loaded is not read, and read is not applied (shared.md's own line).
2. **It pushed a report commit to the branch carrying the candidate, where `qa.md` says QA does not
   push to the candidate's branch.** **Judged: the act was right and the rule's wording is too
   broad.** The push was authorised by Aaron directly, it added evidence on top of a frozen and
   already-scored SHA, and it changed nothing QA evaluated. The rule's purpose is that QA never alters
   what it scores. The wording should say that, not forbid all pushes. **A `qa.md` edit is a role
   file, so it goes to Aaron as its own PR.** Until then, this judgement is the record.
3. **Report 1 lacked two of `qa.md`'s required sections.** Candidate A's report carries all four.

Error entries E1–E5 are accepted as the QA seat classified them, together with the two near-misses by
family. Setting them before being asked is the behaviour the session-77 handoff says not to treat as
friction.
