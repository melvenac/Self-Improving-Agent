# T-168 suite meta

Heavy runs on the QA PC and laptop use `npm run test:heavy` in `open-brain` (`src/cli-suite-run.ts`).

- Lease: `%USERPROFILE%\machine-lease.ps1` with `-File`. The default owner is the nearest cursor-agent host ancestor, or the `claude.exe` session under Claude Code. `--owner-pid` overrides that. No owner and no flag refuses, and the reason is in the meta. `process.ppid` is only where the walk starts. The live walk is `findCursorAgentHostPid` after #427 merges; until then an unbound resolver refuses, and tests inject `SUITE_ANCESTRY`. Any take exit other than 0 refuses. On win32 a missing helper refuses unless `SUITE_LEASE_OPT_OUT=1`. A lease already held by that same owner runs with no take and no release.
- Census: `GET $HUB_URL/a2a/agents/presence` with `X-Agent-Key` read from `--key`, or from `SUITE_KEY_PATH`, or from `$A2A_KEY_DIR` / `~/.a2a-hub/keys/<host>-<port>/<hub_name>.key` (same layout as hub-key.mjs, reimplemented; session-start is not imported). The default hub name is the `--seat` value (`cursor-builder` here). Two samples. No key, HTTP failure, empty roster both times, or a body without `seat.seatState` is `census unavailable: …`, never idle.
- Census: `GET $HUB_URL/a2a/agents/presence` with `X-Agent-Key` read from `--key`, or from `SUITE_KEY_PATH`, or from `$A2A_KEY_DIR` / `~/.a2a-hub/keys/<host>-<port>/<hub_name>.key` (same layout as hub-key.mjs, reimplemented; session-start is not imported). The default hub name is the `--seat` value (`cursor-builder` here). Two samples. No key, HTTP failure, empty roster both times, or a body without `seat.seatState` is `census unavailable: …`, never idle.
- Live row, QA PC, 2026-10-04T11:02:29Z, seat key for cursor-builder, hub `http://100.124.212.87:4000`. `readCensus` returned available (HTTP 200). Own seat `cursor-builder` is `working`. Redacted roster (names and seatState only):

```json
{
  "source": "hub-presence",
  "timestamp": "2026-10-04T11:02:29.716Z",
  "available": true,
  "own_seat": [{ "name": "cursor-builder", "seatState": "working" }],
  "agents": [
    { "name": "chisel", "seatState": "idle" },
    { "name": "cursor-builder", "seatState": "working" },
    { "name": "cursor-infra", "seatState": "working" },
    { "name": "forge", "seatState": "working" },
    { "name": "rivet", "seatState": "working" }
  ]
}
```
- D-034: a foreign seat `working` is stored on the meta and the run continues. `OPEN_BRAIN_CONTROLLED_RERUN=1` refuses when a SIA seat or any `-waker` is `working`, or when the census is unavailable.
- Meta fields: `git_sha`, `seat`, `owner_pid`, `owner_source`, `owner_reason`, `lease_status`, `lease_take_exit`, `lease_release_exit`, `census` (timestamp, source, agents), `vitest.passed`, `vitest.failed`, `vitest.errors`, `vitest.exit_code` (separate, for G-042).
- CI (`ci.yml`, merges on Aaron's word): `scripts/write-ci-suite-meta.mjs` plus an upload step. Runner name, labels, timestamp. `concurrent_jobs` is `unknown` without a token.

Do not import `pipelines/session-start/hub-presence.ts`.
