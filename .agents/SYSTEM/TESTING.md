# Testing Strategy

> `open-brain/` is a TypeScript package with a real suite; the rest of the repo is documentation and
> one standalone script. Testing focuses on the package, plus checks that the documentation agrees
> with it.

## Test Layers

| Layer | What | How |
|---|---|---|
| **open-brain test suite** | 584 tests across 44 test files — MCP server, DB adapters, state reader/writer, scorer, sync checks, recall and session-end pipelines | `cd open-brain && npm test` |
| **Typecheck** | The package compiles under `tsc --noEmit` | `cd open-brain && npm run typecheck` |
| **CI** | The suite runs on push | `.github/workflows/ci.yml`; `/sync`'s `ci-status` check reports the conclusion for the current SHA |
| **Structural consistency** | Version drift, command mirrors, state schema, merge markers, vault/index parity | `ob_sync` (the `/sync` command) |
| **Semantic consistency** | Whether protocol documents agree with each other — what `/sync` cannot see | `/harness-audit`; required for every minor and major release |
| **Hook integration** | The two hooks fire and produce output | Run a short session; `cli-bootstrap.js` prints the project and session line at start, `cli-session-end.js` prints `[session-end]` lines at end |
| **Retrieval** | `ob_recall` returns relevant results | Call `ob_recall` with a known topic and check the ranking; `ob_stats` for corpus counts |
| **Template validation** | The template scaffolds correctly | Copy `project-template/` to a temp dir, run `/start`, verify a session log is created |

## What We Don't Test

- No unit tests for markdown documentation — **this is the gap Loop 11 was spent on.** A false
  sentence in a command file has nothing that fails. `/sync` checks that mirrors match and that
  referenced files exist; it cannot check that a sentence is true.
- No coverage metrics.
- One known intermittent failure under the full suite (`state-writer.test.ts`, G-016); it passes
  30/30 in isolation.

## Validation Commands

```bash
# The suite, and the typecheck
cd open-brain && npm test
cd open-brain && npm run typecheck

# Structural checks (also runs as the /sync command)
node open-brain/build/cli.js sync

# Health score with per-category breakdown
node open-brain/build/cli.js sync --score

# Browse sessions, chunks and knowledge — reads ~/.claude/open-brain/knowledge-v2.db, read-only
node open-brain/scripts/dashboard.mjs   # localhost:3456
```

> **Every row of this file was false before Loop 11.** It named four `.mjs` scripts that do not
> exist, `knowledge-mcp/` (renamed `open-brain/`), the retired `kb_*` tool prefix, the v1 vault path,
> a test count 287 short, and "No CI/CD pipeline" while `.github/workflows/ci.yml` was green. It is
> recorded here because a file about how the project verifies things had never itself been verified.
