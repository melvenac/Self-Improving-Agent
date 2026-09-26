| invocation (as documented) | parsed as | result | first seen (of N) |
|---|---|---|---|
| `detach` | `` | parses | .agents/roles/shared.md:210 (12) |
| `relocate` | `` | parses | CHANGELOG.md:1356 (4) |
| `relocate --from` | `--from` | REFUSED: --from needs a value | open-brain/src/cli.ts:234 (2) |
| `relocate --from <dir> --to <dir>` | `--from . --to .` | parses | CHANGELOG.md:1441 (1) |
| `start` | `` | parses | .agents/skills/self-improving-agent-guide/SKILL.md:174 (4) |
| `start exit 0` | `exit 0` | REFUSED: takes at most one directory, got "exit", "0" | .agents/state.json:1333 (1) |
| `start exit 0 cli-bootstrap.js` | `exit 0 cli-bootstrap.js` | REFUSED: takes at most one directory, got "exit", "0", "cli-bootstrap.js" | .agents/state.json:2729 (1) |
| `state <show` | `` | no spec (state <show) | open-brain/tests/shared/cli-args.test.ts:155 (1) |
| `state <show [--json]` | `` | no spec (state <show) | open-brain/src/cli.ts:327 (1) |
| `state apply` | `` | no spec (state apply) | open-brain/src/pipelines/state-import/index.ts:378 (1) |
| `state import` | `` | out of scope (state import) | CLAUDE.md:53 (3) |
| `state import --commit` | `` | out of scope (state import) | .agents/SYSTEM/DECISIONS.md:263 (5) |
| `state import --commit .` | `` | out of scope (state import) | .agents/state.json:2200 (1) |
| `state import --draft` | `` | out of scope (state import) | open-brain/tests/fixtures-import/.agents/SESSIONS/next-session.md:5 (3) |
| `state import --draft writes` | `` | out of scope (state import) | .agents/SYSTEM/SUMMARY.md:17 (2) |
| `state import --draft\` | `` | out of scope (state import) | open-brain/src/pipelines/state-import/index.ts:610 (1) |
| `state import [--draft` | `` | out of scope (state import) | CHANGELOG.md:1329 (2) |
| `state migrate` | `` | parses | CHANGELOG.md:156 (3) |
| `state show` | `` | parses | README.md:87 (1) |
| `state show [--json]` | `--json` | parses | .agents/state.json:909 (1) |
| `state show [--json] [dir]` | `--json dir` | positional is not a directory here ("dir") - flags OK | CHANGELOG.md:1306 (1) |
| `state show <fixture>` | `PLACEHOLDER` | positional is not a directory here ("PLACEHOLDER") - flags OK | docs/loops/loop-14-qa-criteria.md:333 (1) |
| `sync` | `` | parses | .agents/SYSTEM/TESTING.md:37 (6) |
| `sync --check` | `--check` | parses | docs/loops/loop-13-c2-c4-boundary.md:127 (16) |
| `sync --check >` | `--check >` | positional is not a directory here (">") - flags OK | docs/loops/loop-15-slice-2-qa-criteria.md:346 (4) |
| `sync --check-only` | `--check-only` | REFUSED: unrecognised flag "--check-only". Accepted flags: --check, --score, --json, --history | .agents/state.json:320 (2) |
| `sync --help` | `--help` | REFUSED: unrecognised flag "--help". Accepted flags: --check, --score, --json, --history | .agents/state.json:320 (1) |
| `sync --score` | `--score` | parses | .agents/SYSTEM/TESTING.md:40 (5) |
| `sync [--check] [--score]` | `--check --score` | parses | .agents/skills/self-improving-agent-guide/SKILL.md:173 (1) |
| `sync >` | `>` | positional is not a directory here (">") - flags OK | docs/loops/qa-scripts-a5/plainsync.sh:12 (3) |
| `topics` | `` | parses | open-brain/tests/fixtures-import/.agents/SYSTEM/SUMMARY.md:9 (1) |
| `topics [--min=<n>] [--apply]` | `--min=<n> --apply` | parses | CHANGELOG.md:1446 (1) |
