# T-168 suite meta

Heavy runs on the QA PC and laptop use `npm run test:heavy` in `open-brain` (`src/cli-suite-run.ts`).

- Lease: `%USERPROFILE%\machine-lease.ps1 take` with `-OwnerPid` (D-119: pass the cursor-agent pid). Exit 10 refuses. Release on exit 0 only.
- Census: `GET $HUB_URL/a2a/agents/presence` with `X-Agent-Key` from `--key` or `SUITE_KEY_PATH`. Two samples. No key, HTTP failure, empty roster both times, or a body without `seat.seatState` is `census unavailable: …`, never idle.
- Live read on 2026-10-04 before this branch: `GET http://100.124.212.87:4000/a2a/agents/presence` with `dev-key` returned **403**. The reader follows the ruled v1.17 shape (`agents[].seat.seatState`: working, idle, owes_reply, paused, waker_down, alarm) and does not treat the older top-level `state` field as idle.
- D-034: a foreign seat `working` is stored on the meta and the run continues. `OPEN_BRAIN_CONTROLLED_RERUN=1` refuses when a SIA seat or any `-waker` is `working`, or when the census is unavailable.
- Meta fields: `git_sha`, `seat`, `lease_status`, `census` (timestamp, source, agents), `vitest.passed`, `vitest.failed`, `vitest.errors`, `vitest.exit_code` (separate, for G-042).
- CI (`ci.yml`, merges on Aaron's word): `scripts/write-ci-suite-meta.mjs` plus an upload step. Runner name, labels, timestamp. `concurrent_jobs` is `unknown` without a token.

Do not import `pipelines/session-start/hub-presence.ts`.
