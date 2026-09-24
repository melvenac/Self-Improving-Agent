# Infra: a self-hosted GitHub Actions runner on tcm (brief for a FRESH Claude developer session)

**By:** Atlas (planner), record session 90 · 2026-09-24. **To:** the developer seat (Forge) in
`~/Worktrees/sia-infra`, **record session 97**. `~/Worktrees/sia-forge` is Grok's, for A7. Do not use it.

## Why

- GitHub warned at **1,802 of 2,000** included Actions minutes, with 7 days to the reset. That is account-wide.
- In SIA since 2026-09-21, about 70% of minutes went to PR and master CI on docs/record-only changes (measured by
  the planner from `gh run list`).
- **A self-hosted runner's minutes are free.** It also gives Linux, which this Windows machine cannot, for the
  POSIX-only link tests.

## Authority

Aaron, in the SIA planner session, 2026-09-24, verbatim, in order:
- "yes, set it up now";
- "TCM server is not used much at all. For now it's only being used for the hub dev. Ready for sia infra?"

The second overrides, for this purpose only, his 2026-09-02 ruling that tcm is "not a scratch host for agents"
(`~/.claude/projects/C--Users-melve/memory/reference_tcm_server.md`). **This covers installing and registering ONE
runner on tcm for `melvenac/Self-Improving-Agent`, and nothing else on tcm.**

## Facts about tcm (from that reference note; re-check before relying on them)

- **Access:** `ssh melvenac@100.124.212.87` over Tailscale (node `tcm`), passwordless sudo.
- **Machine:** Ubuntu 24.04, an Intel N95 with 4 cores and 16 GB RAM, Docker 29.
- **Also on tcm:**
  - the A2A-Hub hub, a container on port 4000, with Convex on 127.0.0.1:3210;
  - two OctoPrint containers (the makerspace 3D printers, on USB serial);
  - `doorctl-controller.service` (door access, mock mode);
  - Samba.

  **Touch none of them.**
- **A2A-Hub's planner (Relay, session `a2a-planner-6c`) coordinates tcm deploys.** Tell it, through the planner,
  before you change anything on tcm.

## The work

1. **Look first, change nothing:** free disk, CPU and memory; what is running; whether a runner already exists
   (`gh api repos/melvenac/Self-Improving-Agent/actions/runners`). Report it.
2. **Install ONE runner, isolated.** A dedicated unprivileged user (for example `gh-runner`):
   - no sudo;
   - **not** in the `docker` group, since docker group membership is root;
   - no read access to the hub's `.env`, `~/data`, `/opt/doorctl` or `/var/lib/doorctl`.

   Run it as a systemd service with a CPU cap (for example `CPUQuota=200%`, so 2 of 4 cores) and a low
   `Nice`/`IOWeight`, so the hub and the printers keep priority. A container is acceptable instead, if it meets
   the same limits without widening privileges. Labels: `self-hosted`, `linux`, `tcm`.
3. **Registration token:** `gh api -X POST repos/melvenac/Self-Improving-Agent/actions/runners/registration-token`.
   It expires in an hour. Pass it straight to the runner's config command, and do not echo it into a file.
4. **Prove it on a branch, with no change to master's CI:**
   - on `chore/tcm-runner`, add a separate workflow (for example `.github/workflows/ci-tcm.yml`) with
     `runs-on: [self-hosted, linux, tcm]` and `workflow_dispatch`, running the same steps as `ci.yml`;
   - dispatch it (D-040);
   - read the log per test;
   - compare the test count with a GitHub-hosted run at the same SHA;
   - record the runner's git and Node versions, and the wall time.
5. **Then propose the switch as a PR, and do NOT merge it:** PRs and non-master pushes run on tcm; pushes to
   `master` stay on `ubuntu-latest` ("GitHub only for major updates", Aaron). `ci.yml` is outside D-032's allowlist,
   so **Aaron merges it**. Say in the PR what changes for D-032's merge gate (the checks' names).

## Rules

- **Never run anything on tcm beyond the runner and its service.** Never stop, restart or rebuild the hub, OctoPrint,
  doorctl or Samba.
- **Push only your own `chore/tcm-runner` branch** (D-038). Never `master`, and never force.
- **Ask the planner before any full LOCAL suite on this machine** (G-042). QA 96 will soon need it quiet.
- **On a refusal, a denied command, or anything unexpected on tcm: stop and tell the planner.**
- **Hand back** `docs/loops/infra-tcm-runner-handoff.md` on your branch. Cover:
  - what was installed, where, and as which user;
  - the limits applied;
  - the test run on tcm (run id, per-test result, versions, wall time);
  - how to remove it (the exact commands);
  - what was not verified;
  - model and effort.
