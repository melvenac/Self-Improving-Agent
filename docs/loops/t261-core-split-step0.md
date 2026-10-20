# T-261 step 0: where the core/memory boundary stands, and the order to split it

**By:** Atlas (planner), 2026-10-19, session 173. **Task:** T-261 (P3; D-151: after T-154, which closed in s168).
**Asked by:** Aaron, 10-19 ("have you started on the core yet?" → "go ahead"). **Measured at:** master `c3b5ceec`.
**Instrument:** `open-brain/src` extracted with `git archive`, then a read-only script that reuses `/sync`'s own
`MEMORY_SIDE` list and import resolution. It adds two things the check does not do: dynamic `import()` and
"who imports this file". No code ran from the repo; nothing was built.

The idea is Idea B of the Step-Back page: the **project protocol** (the `.agents/` record, `/start`, the hooks, `/sync`,
the state CLI) is the core, installable by a stranger with Node and git. **Memory** (the knowledge DB, recall, the
recall trigger, session-end capture, topics, shadow recall) is an opt-in module the core never depends on.

## What is already true

| Measure | Core | Memory |
|---|---|---|
| Source files | 130 | 26 |
| Lines | 36,002 | 7,361 |
| How a file is classified | everything not listed | the 13 entries of `MEMORY_SIDE` in `pipelines/sync/checks.ts` |
| npm packages imported at run time | `zod`, `yaml`, `node:*` | `better-sqlite3`, `@modelcontextprotocol/sdk`, `zod`, `node:*` |

- **Static value imports, core → memory: 0.** `/sync`'s `module-boundary` check holds, and it has held since Loop 13.
- **Memory → core:** memory imports 24 core files. That is the API a core package would have to export.
- **The native build is memory-only.** `better-sqlite3` is already an `optionalDependency`, and only memory files
  import it statically.
- **T-154 (s168)** gave `/start` a route that works without memory.

## What the measurement found

### 1. `cli.ts` reaches memory through dynamic imports the check cannot see

`checkModuleBoundary` matches only static `import … from` statements, so `await import(...)` is invisible to it. Its
own doc comment lists three limits; this is a fourth. `cli.ts` is core and makes 10 dynamic imports of memory files,
plus one of `better-sqlite3`, from 5 subcommands:

| Subcommand | Reaches |
|---|---|
| `sync` | `pipelines/sync/checks-memory.ts` (optional by design: on failure it reports three SKIPPED checks); with `--score`, also `score.ts` and `db-v2.ts` |
| `relocate` | `db-v2.ts` |
| `scrub-trigger-fires` | `scrub-trigger-fires.ts` |
| `trigger-keys` | `better-sqlite3`, `trigger/keys-writer.ts`, `trigger/match-keys.ts` |
| `topics` | `db-v2.ts`, `pipelines/topics/index.ts` |

Only `sync` was built to work when memory is absent. The other four are memory commands living in the core CLI.

### 2. Five "core" files are memory in all but name

Each of these is imported by memory and by **no** core file, statically or dynamically:

- `lifecycle.ts` (recall ranking)
- `shared/fts.ts`
- `shared/vault-path-segment.ts`
- `shared/yaml-frontmatter.ts`
- `shared/content-guard.ts`

They sit on the core side only because the list defaults new files to core. Moving them into `MEMORY_SIDE` changes
nothing at run time and shrinks the core API from 24 files to 19.

### 3. The MCP server is memory, but it serves core tools

`server.ts` is on the memory side, which is right: it loads `better-sqlite3` at module load. It also registers
`ob_start`, `ob_state`, `ob_sync`, `ob_set_session`, `ob_score` and `ob_end`. The commands call these tools:
`ob_start` 12 times, `ob_sync` 7 and `ob_state` 4. The other three are memory tools (`ob_end` closes memory). So a
core-only install cannot use the tools its own commands name. It uses the CLI route T-154 documented instead.

### 4. `yaml` is a run-time import with a dev-only declaration

`planner-hook/prfiles.ts` (core) imports `parse` from `yaml`, but `package.json` lists `yaml` under
`devDependencies`. Today's install is a plain `npm install` (README line 61, `scripts/setup.mjs`), which installs dev
dependencies, so nothing breaks. A published core package, or any `--omit=dev` install, would fail the planner hook
at load. In a split, `yaml` becomes a core dependency.

## Proposed order

Each step is one PR, through the normal path: a SIM on the QA PC first, a brief with verbatim edits, QA ACCEPT, and
an SG-1 merge. A step changes no behaviour unless it says so.

1. **S1: the boundary check sees everything** (small; code).
   - `checkModuleBoundary` also matches `import("./…")` and `import("better-sqlite3")`.
   - Core files may still reach memory dynamically, but only from an explicit allowlist. It starts as exactly the
     5 subcommands above, so the check stays green and any new crossing goes red.
   - `MEMORY_SIDE` gains the 5 files in finding 2.
   - `yaml` moves to `dependencies`.
   - Test rows: a fixture with an unlisted dynamic crossing is red; the allowlisted ones are green.
2. **S2: memory commands leave the core CLI** (small to medium; code).
   - `relocate`, `scrub-trigger-fires`, `trigger-keys` and `topics` move behind a memory entry point.
   - Either a `cli-memory.ts` bin, or `open-brain memory <cmd>`, with the old names kept as aliases for one
     version and printing where they moved.
   - `sync --score` follows the same rule as the memory checks: optional, and SKIPPED with a reason when memory is
     absent.
   - The allowlist from S1 then shrinks to `sync`'s two optional loads.
3. **S3: the physical split** (medium; mostly file moves).
   - npm workspaces under `open-brain/`: `packages/core` and `packages/memory`, with TypeScript project
     references so memory builds against core's declarations.
   - **The hard constraint:** installed hooks name build paths (`open-brain/build/cli-bootstrap.js`,
     `cli-session-end.js`, `cli-recall-trigger.js`, `cli-planner-hook.js`). Those paths keep working, either
     because the build output stays where it is or because shims are left behind.
   - `/sync` checks hook registration against the same paths.
4. **S4: the install path** (small).
   - `scripts/setup.mjs` installs core by default; memory, with its native build, is opt-in.
   - Acceptance test: on a fresh machine with Node and git only, `/start` works.
   - This is the Step-Back page's Q1 test and T-154's.
5. **Later, only if wanted: a core MCP server.**
   - A small server carrying `ob_start`, `ob_state` and `ob_sync`, with no native build.
   - Memory's server adds the memory tools.
   - Until then, core-only seats use the CLI route.

## Open for Aaron (one question, with my recommendation)

S3 is the expensive step. **Rec: do S1 and S2 now**, because they are cheap and each stands on its own. S1 closes a
blind spot in a check that is already trusted, and S2 makes the core CLI honest about what it needs. **Then decide
S3/S4 against a real second user**, someone installing SIA without memory. Until that user exists, the boundary is
enforced by the check and the packages stay one. That is the same choice D-151 made in setting low priority.
