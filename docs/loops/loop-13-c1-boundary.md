# Loop 13 — C1 boundary report

**From:** Forge (Developer) · **To:** Atlas (Planner) · **Date:** 2026-09-17
**Base pinned:** `master` @ `669902c` — v0.38.0, state rev 31.
**Branch:** `loop/13-module-boundary`. **Nothing has been moved. This is enumeration only.**

The brief pins `917fd68` / rev 28. That base is two moves stale (#35, #37, #36 landed since).
The brief's own first line says *check it, do not assume it* — this is that line earning its keep.

---

## Method, stated before the numbers

Two things are counted, and they are counted differently.

**The code boundary** is a **resolved import graph**, not a text search. Every `.ts` under
`open-brain/src` (44 files) was parsed for `import`/`export … from` specifiers; relative specifiers
were resolved to real files (`.ts`, then `index.ts`); the graph was closed transitively. **Zero
specifiers failed to resolve** — an unresolved one would have dropped an edge silently, which is the
rule 11 failure this enumeration is most exposed to, so it is reported rather than assumed.

**Memory roots** are files with a *value* import of `better-sqlite3`, plus `vault-writer.ts`.

**`import type` is excluded, and this changed the answer.** My first run counted type-only imports as
runtime edges and reported **14 memory roots**. Seven of those were type-only — erased by `tsc`,
absent at runtime. The corrected count is **7**. The files that moved: `relocate.ts`,
`topics/index.ts`, `shadow/evaluate.ts`, `shadow/index.ts`, `sync/score.ts`, `server.ts`,
`session-end/recalled-ids.ts`. **The instrument was wrong first and the correction is what produced
the real number** — recorded here because the uncorrected run would have overstated the boundary by
exactly 2x.

**Limit of this method, stated as `command-tool-names` and `retirements` both do:** it sees imports.
It cannot see an instruction that tells an agent to call a tool. That blind spot is the entire reason
for the second enumeration below.

---

## 1. The code boundary — smaller than "split two products" sounds

**Per directory, by resolved runtime import graph:**

| Directory | Reaches memory | Brief's probe | Agrees? |
|---|---|---|---|
| `pipelines/session-start` | **0 of 9** | 1 of 9 | **NO** |
| `pipelines/state-views` | 0 of 1 | 0 of 1 | yes |
| `pipelines/state-import` | 0 of 1 | — | — |
| `shared` | **0 of 9** | — | — |
| `pipelines/sync` | 2 of 7 *(+1 via memory-side helpers)* | 2 of 7 | yes |
| `pipelines/store` | 1 of 1 | 1 of 1 | yes |
| `pipelines/session-end` | 4 of 4 | 4 of 4 | yes |
| `pipelines/topics` | **0 of 1** | 1 of 1 | **NO** |
| `pipelines/shadow` | 2 of 3 | 2 of 3 | yes |

**Two corrections to the probe, in opposite directions:**

- **`session-start` is 0 of 9, not 1 of 9.** The single hit was `health-checks.ts` matching the
  *word* "vault" in text. It has no import reaching memory. **The startup pipeline is already
  wholly clean** — this is rule 8 (a substring answers a different question) in the brief's own probe.
- **`topics` is 0 of 1, not 1 of 1.** Its `better-sqlite3` import is `import type`.

**The entire protocol-side crossing is one file.** `cli.ts` — the thin CLI the brief names as the
obvious route — reaches memory through exactly one chain:

```
cli.ts  ->  pipelines/sync/index.ts  ->  pipelines/sync/checks.ts   [opens the DB]
```

`sync/checks.ts` (1340 lines) opens the database in **three functions, all memory-specific, each
already taking `dbPath` as a parameter**:

| Line | Function | Emits check |
|---|---|---|
| 343 | `checkVaultIndexParity` | `vault-index-parity` |
| 507 | `checkSchemaVersion` | `schema-version` |
| 557 | `checkProjectDirsExist` | `project-dirs` |

**They are separable by extraction, not by redesign.** That is the whole code-side cut.

---

## 2. The invocation boundary — and the blocker is not where the brief expected

**13 distinct `ob_*` names across the command surface** — the brief's number, confirmed. Counted from
the files, not re-derived by hand:

| Command | Mentions | Tools named |
|---|---|---|
| `end.md` | 15 | `ob_end ob_feedback ob_forget ob_recall ob_recalled ob_start ob_state ob_store ob_sync` |
| `start.md` | 10 | `ob_list ob_recall ob_set_session ob_start` |
| `sync.md` | 8 | `ob_score ob_sync` |
| `checkpoint.md` | 4 | `ob_recall ob_store_chunk` |
| `harness-audit.md` | 2 | `ob_sync` |
| `task.md`, `test.md` | 0 | — |

`project-template/.claude/commands/` mirrors this exactly, minus `harness-audit.md`.

**`server.ts` registers 14 tools and opens the DB lazily**, through `getV2Db()`, at 11 call sites.
Mapping each site to its handler by line range:

**Never touch the database:** `handleSync` (115–193), `handleStart` (194–300), `handleState`
(301–356). **The three protocol lifecycle tools are already DB-free.**

**`ob_set_session` opens the DB — but already degrades.** `recordSession` sits in a try/catch and the
response says *"warning: not persisted to the sessions table"* when it fails. It does not hard-fail
without a database.

**`ob_end` opens the DB unconditionally** at line 360. `/end` genuinely needs memory today.

### The actual blocker, and it is one line

`ob_start`, `ob_state` and `ob_sync` never call the database — **and are still unreachable without
it**, because `server.ts` imports `db-v2.js`, which has a *value* import of `better-sqlite3`. The
native module is resolved at **module load**, before any handler runs. `open-brain/package.json`
declares `better-sqlite3 ^12.6.2` as a **runtime dependency**.

**So the boundary is not a logic problem in the tools. It is a load-time dependency in the module
that serves them.** Q1 of the original evaluation — *installable by a stranger with Node and git* —
is violated by the dependency edge alone, and no amount of laziness inside the handlers fixes it.

**This is the loop in miniature, and it is smaller than the brief feared.** The brief expected `/start`
to be the hard part because it "reaches memory through an MCP tool." Measured: `/start`'s pipeline is
0 of 9, its two tools are DB-free or already-degrading, and `cli-bootstrap.ts` — the file the
SessionStart hook actually runs — **does not reach memory at all**.

---

## What is in both enumerations, what is in each alone

- **In both:** `pipelines/sync` — `checks.ts` crosses in code, and `/sync` + `harness-audit` name
  `ob_sync`/`ob_score` at the invocation layer.
- **Code only:** `cli-session-end.ts` → `db-v2.ts`. A hook binary, named by no command file.
- **Invocation only, and this is the set the import graph cannot see:** `ob_start`, `ob_state`,
  `ob_sync` — clean code, reached through a module that cannot load without a native build. **An
  import-direction check would pass on all three and the acceptance test would still fail.**

**That asymmetry is C3's requirement.** A check that only asserts "core does not import memory" is
satisfied by today's tree at `session-start`, and says nothing about the thing that actually breaks
C4.

---

## Recorded, not fixed — surfaced by the enumeration, out of scope per C2

1. **T-151 appears already satisfied.** `.gitattributes` exists at `669902c` and `docs/loops/*.md`
   is LF in the working tree. The session-63 watch-out says these files are CRLF; that is stale.
   **Not closed here** — closing a task is a state write and rev 31 is being held.
2. **`sync/score.ts` reaches memory** via `session-end/invocation-logger.js` and `shadow/index.js`,
   not via its own `better-sqlite3` (type-only). Health scoring is memory-side by role; noted so the
   3-of-7 figure is not read as three independent crossings.

---

## Counts, for the record

44 files parsed · 0 unresolved specifiers · 7 memory roots · 3 external runtime deps
(`better-sqlite3`, `zod`, `@modelcontextprotocol/sdk`) · 13 `ob_*` names on the command surface ·
14 registered tools · 11 DB-open sites · **1 protocol-side crossing file** · 3 functions to extract.

**Nothing moved. Awaiting the C2 go-ahead.**
