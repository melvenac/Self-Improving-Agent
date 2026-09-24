# Infra: the self-hosted runners on tcm — developer handoff

**By:** Forge (developer seat), **record session 97**, 2026-09-24, in `~/Worktrees/sia-infra`.
**For:** Atlas (planner), record session 90, and Aaron through the planner (D-038).
**Brief:** `docs/loops/infra-tcm-runner-brief.md` (at the time of writing, in the planner's tree only), with
the scope change D-044 and Relay's requirements, both relayed by the planner.
**Model and effort:** Claude Opus 5.5 (1M context), effort **low** (the harness setting; the planner has
flagged it to Aaron as worth raising for firewall work).

**Current state:** two runners, **`tcm-1` (id 22) and `tcm-2` (id 23)**, both online. The first design was
a single runner, `tcm` (id 21). It was proven, then deregistered and replaced under D-044. Its evidence
is kept below, because it is the evidence for the firewall, isolation and test parity.

## Authority, as it was used

- **D-043, quoted in the brief (Aaron to the planner, 2026-09-24):** "yes, set it up now"; "TCM server is
  not used much at all. For now it's only being used for the hub dev. Ready for sia infra?"
- **The planner's GO for step 2 (A to D, as written), relayed by A2A**, with one required addition: the
  fail-closed check. The planner also approved the IPv6 change (reject all IPv6).
- **Relay (A2A-Hub's planner), relayed by the planner:** no objection to A to D. Its requirements are in
  section 4.
- **First host-level stop, cleared by Aaron in this window.** Writing the systemd units was denied by
  Claude Code's auto-mode classifier ("Unauthorized Persistence"). I stopped, told the planner, and did not
  look for another route. Aaron then said, verbatim: **"go ahead, I have this session in manual mode"**.
  The single runner was installed after that.
- **D-044, relayed by the planner (record rev 117), Aaron verbatim in the planner session:** "add a second
  runner on tcm, max out it's resources." The planner's reading, recorded as the planner's: use every idle
  core, but the hub and Convex still win when they need CPU.
- **Second host-level stop, also cleared by Aaron in this window.** The classifier stopped the first D-044
  edit with the same reason. I stopped again and told the planner. Aaron asked whether a permission setting
  would prevent the blocking, and I explained the options without changing any setting. Aaron then said,
  verbatim: **"manual mode is on"**. From then on every command ran under his per-command approval in
  this window. The D-044 work was done after that message.

## 1. What is installed, where, and as which user

All on tcm (Ubuntu 24.04.4, 4 cores, 15.4 GiB). Copies of every installed file, **byte-identical** (all 7
sha256 hashes compared after the D-044 install), are in `docs/loops/infra-tcm-runner/`.

| What | Where | Owner |
|---|---|---|
| User `gh-runner` (system user, uid 999, gid 986, shell `/usr/sbin/nologin`, **no** sudo, groups: only its own). **Both runners run as this one user**, so the one owner-matched firewall covers both. | home `/srv/gh-runner`, mode 0750 | — |
| actions/runner **v2.337.0**, sha256 `70920811…6613` (matches GitHub's published digest) | `/srv/gh-runner/runner-1`, `/srv/gh-runner/runner-2` | gh-runner |
| Registered runners **`tcm-1` (id 22)** and **`tcm-2` (id 23)**, labels `self-hosted, Linux, X64, tcm` | repo `melvenac/Self-Improving-Agent` | — |
| `gh-runner@.service`: a template; instances `@1` and `@2` enabled | `/etc/systemd/system/` | root (runs as gh-runner) |
| `gh-runner-egress`: the firewall script (apply / check / watch / remove) | `/usr/local/sbin/`, 0755 | root |
| `gh-runner-egress.service`: oneshot that applies the firewall at boot and removes it on stop | `/etc/systemd/system/`, enabled | root |
| `gh-runner-egress-watch.service` + `.timer` (every minute) | `/etc/systemd/system/`, timer enabled | root |
| `gh-runners-pause`, `gh-runners-resume` (for A2A-Hub deploys; section 4) | `/usr/local/sbin/`, 0755 | root |

Registration and removal tokens went from `gh api` through ssh's stdin into `ACTIONS_RUNNER_INPUT_TOKEN`,
never onto a command line or into a file. The temporary install folders on tcm were deleted.

**The D-044 migration:**
1. Stopped and disabled `gh-runner.service`, and deregistered `tcm` (`config.sh remove`).
2. Removed the old unit and installed the template, the updated script and the pause/resume scripts.
3. Re-applied the firewall.
4. Moved `runner` to `runner-1` (keeping its warm tool cache) and copied it to `runner-2` without
   `_work` and `_diag`.
5. Registered `tcm-1` and `tcm-2`, and started both.

## 2. The limits applied

**Resources (D-044), per runner, read back with `systemctl show`:**
- **No CPU quota** (`CPUQuotaPerSecUSec=infinity`), so idle cores are used.
- `CPUWeight=20` and `IOWeight=20` against the default 100 that the hub's and Convex's containers get,
  and `Nice=10`. So the hub, Convex and the printers win whenever they want CPU or I/O.
- **`MemoryMax=5G` each, 10 GiB for both, of tcm's 15.4 GiB.** Before the install tcm used 1.6 GiB, with
  13 GiB available. That leaves at least 5.4 GiB the runners can never take, for the hub (~34 MiB),
  Convex (~81 MiB), the two printer stacks, doorctl and the page cache, plus 4 GiB of swap.
- **`OOMScoreAdjust=500`** (Relay), inherited by every job process, so under memory pressure the kernel
  kills a CI job before the hub or Convex.

**Isolation inside each unit:** `NoNewPrivileges`, `PrivateTmp`, `PrivateDevices`, `ProtectHome=yes`,
`ProtectSystem=strict` with `ReadWritePaths=/srv/gh-runner`, and
`InaccessiblePaths=/opt/doorctl /var/lib/doorctl /etc/doorctl /run/docker.sock`. Tested in the first
design's unit, which had the same lines. I tested inside the running unit's mount namespace as gh-runner,
with the same test OUTSIDE the unit as the positive control:

| Path | Inside the unit | Outside (control, same user) |
|---|---|---|
| `/opt/doorctl` | Permission denied | readable (`schema.sql`) |
| `/var/lib/doorctl` | Permission denied | **readable (`door.db`)** |
| `/etc/doorctl` | Permission denied | Permission denied |
| `/run/docker.sock` | `s--------- root:root`, connect refused | `srw-rw---- root:docker` |
| `/usr/local` (write) | Read-only file system | — |

Under D-044, each tcm-1 and tcm-2 job printed `denied: /opt/doorctl` from inside the job (section 3). My
first version of the table used `ls -ld` and reported the masked paths as READABLE. That was the
instrument: it stats the mount point, and systemd's mask is a stat-able mode-000 node. The table uses
real reads.

**Egress firewall.** A chain `GH_RUNNER` (IPv4 and IPv6), reached by one jump at **OUTPUT rule 1**:
`-m owner --uid-owner 999 -j GH_RUNNER`. It does **not** touch ufw's rules or files, and it has never
reloaded ufw.
- **IPv4:** DNS to 127.0.0.53 and 127.0.0.54 port 53 is allowed. REJECTed are every host address
  (`addrtype LOCAL`), 0/8, 10/8, 100.64/10 (the tailnet), 127/8, 169.254/16, 172.16/12 (all docker
  bridges), 192.168/16 (the LAN), 224/4 and 240/4. That leaves the public internet.
- **IPv6: everything is rejected** (TCP with a reset, the rest ICMP). tcm has a global IPv6 address on the
  LAN's /64 (`2600:6c86:c00:8::/64`), and the ISP can change that prefix, so a per-prefix rule would go
  stale silently. The planner approved this. TCP gets a reset because the ICMP reject took about 1 s per
  address, and a client that tries addresses one at a time (registry.npmjs.org has 12 AAAA records)
  timed out before it reached IPv4.

**The proof: each target as gh-runner, then as melvenac** (bash `/dev/tcp`, 5 s timeout):

| Target | gh-runner | melvenac |
|---|---|---|
| 127.0.0.1:3210 (Convex) | refused | CONNECTED |
| 172.20.0.2:3210 / :3211 (Convex, direct over the bridge) | refused / refused | CONNECTED / CONNECTED |
| 172.20.0.3:4000, 127.0.0.1:4000, 192.168.1.50:4000, 100.124.212.87:4000, [::1]:4000 (hub) | all refused | all CONNECTED |
| 127.0.0.1:80, :81 (traefik → Mainsail/Moonraker) | refused | CONNECTED |
| 172.18.0.5:7125 (Moonraker, direct) | refused | CONNECTED |
| 192.168.1.50:445 (Samba), 127.0.0.1:22 (ssh) | refused | CONNECTED |
| DNS github.com | 140.82.114.4 | same |
| github.com:443, registry.npmjs.org:443 | CONNECTED | CONNECTED |

Every tcm CI job repeats the internal-target probes as its first step. They printed `blocked:` for all
nine in runs 36062266765 (`tcm`), 36065208124 (`tcm-1`) and 36065211981 (`tcm-2`).

**Fail-closed (the planner's requirement), proven twice:**
1. `ExecStartPre=+/usr/local/sbin/gh-runner-egress check`: a runner will not start unless the jump is
   OUTPUT rule 1 and the chain matches its snapshot, for IPv4 and IPv6. The snapshot is taken at apply
   time into `/run/gh-runner-egress/` (root only).
2. `gh-runner-egress-watch.timer` runs the same check every minute. On a failure it logs to the journal
   (`-t gh-runner-egress`, priority auth.crit) and stops **every** `gh-runner@*.service`.
3. **Proof 1, single runner (UTC):**
   - 21:31:03: I removed the **IPv4** jump by hand.
   - 21:32:00: the watch logged `egress firewall check FAILED, stopping gh-runner.service: IPv4: OUTPUT rule 1 is not the gh-runner jump to GH_RUNNER`.
   - 21:32:01: the runner was inactive, **58 s** after the removal. A manual start was refused (`start rc=1`).
   - Restored, and the runner was online again.
4. **Proof 2, both runners (D-044):**
   - 22:02:03: both active. I removed the **IPv6** jump by hand.
   - 22:03:00: `egress firewall check FAILED, stopping gh-runner@*.service: IPv6: OUTPUT rule 1 is not the gh-runner jump to GH_RUNNER`.
   - 22:03:01: **both inactive, 58 s** after the removal. Starting both was refused (`start rc=1`, both units).
   - Restored with `systemctl restart gh-runner-egress.service`; check OK.
   - `gh-runners-resume` read back `active`/`active`, and both runners were `online`.

   In both proofs the runners were idle for the whole window.

## 3. The test runs on tcm

**Single runner, capped at 2 cores, SHA 4851c96:**

| | tcm (self-hosted) | GitHub-hosted |
|---|---|---|
| Run | **36062266765** (push, `ci-tcm.yml`) | **36062316052** (dispatch, `ci.yml`) |
| Tests | **1034 passed (1034)**, 71 files | **1034 passed (1034)**, 71 files |
| Per-file names and counts | identical (diffed, file by file) | |
| git / Node | 2.43.0 / v22.23.3 (setup-node; the system node is v22.23.2 and was not used) | 2.55.0 / 22.x |
| Job wall time | 2m21s | 1m47s |
| vitest wall time | 70.12 s | 84.92 s |
| setup-node + its post step | 25 s + 11 s (first run: Node download, cold npm cache) | 3 s + 0 s |

The logs show 131 and 135 `✓` lines. The difference is vitest's slow-test lines (60 vs 64), which depend
on machine speed. The per-file lines are identical.

**PR #152's own `pull_request` run (36062954593) at f932290 ran on the self-hosted runner `tcm`: success.**
That is the new `ci.yml` routing a pull request to tcm.

**Two runners, no CPU quota, SHA f932290, three dispatches at once (D-044's parallel proof):**

| Run | Runner (from the log's "Runner name" and the jobs API) | Result | Job | Test step | vitest wall (summed worker time) |
|---|---|---|---|---|---|
| **36065208124** | **tcm-1** | 1034/1034, 71 files | 22:03:18 → 22:04:36 (**1m18s**) | 43 s | **41.88 s** (85.83 s) |
| **36065211981** | **tcm-2** | 1034/1034, 71 files | 22:03:20 → 22:05:04 (**1m44s**) | 37 s | **36.69 s** (76.64 s) |
| **36065215334** (`hosted: true`) | GitHub Actions (ubuntu-latest) | 1034/1034, 71 files | 22:03:22 → 22:05:05 (**1m43s**) | 87 s | **86.32 s** (60.54 s) |

- **The two tcm jobs ran in parallel,** starting 2 s apart, with the two jobs sharing the 4 cores.
- tcm-2's longer job time was **setup-node at 29 s**. runner-2 started with a cold tool cache;
  runner-1 kept runner-1's.
- The hosted run skipped the tcm self-check (`conclusion: skipped`), and it exercises the `hosted: true`
  fallback path of the new `ci.yml`.
- **Load during the parallel jobs:** load average 1.14. The hub answered a connect on :4000 in 4 ms.
  a2a-hub 0.00% CPU, 34 MiB; Convex 0.00% CPU, 81 MiB; 13 GiB of memory still available. My per-runner
  CPU reading from `systemd-cgtop` matched nothing: the filter missed the `@` unit names. So **per-runner
  CPU during the jobs was not measured**.

## 4. Relay's requirements

- **Ports 4000, 3210 and 3211:** the runners bind nothing and only make outbound connections.
- **Left alone:** `~/data/convex-data`, `~/projects/a2a-hub*`, the images, `~/docker-compose/a2a-hub`
  (and its .env), and any `~/.a2a-hub/keys` (none exists). The runners cannot reach them in any case:
  `/home/melvenac` is 0750, and `ProtectHome=yes` hides `/home`.
- **(3a) The owner-matched block:** done, and wider than asked (section 2), because 127.0.0.1 alone
  would have left Convex and the hub reachable over the docker bridge and the hub on every host address.
  Proven in both directions.
- **(3b) Trusted workflows only:** the repo is **private**. `run_workflows_from_fork_pull_requests=false`,
  `send_secrets_and_variables=false`, `send_write_tokens_to_workflows=false`,
  `require_approval_for_fork_pr_workflows=false`. The contributor-approval endpoint answers 422 "Fork PR
  approval is not allowed for private repositories". `allow_forking=true`, but a fork's PRs run no
  workflows.
- **Out-of-memory order:** `OOMScoreAdjust=500` on both units, with `MemoryMax=5G` each. The numbers are
  in section 2.
- **T-057, raw output (read-only, before any change):**
  `sudo ss -ltnp '( sport = :3210 or sport = :3211 )'` gave
  `LISTEN 0 4096 127.0.0.1:3210 0.0.0.0:* users:(("docker-proxy",pid=355695,fd=8))`, with nothing on 3211.
  `docker port convex` gave `3210/tcp -> 127.0.0.1:3210` (rc=0). From the host, Convex is also reachable
  directly at 172.20.0.2:3210 and :3211.
- **Does the jump stay at OUTPUT rule 1 after Docker rewrites its chains? NOT VERIFIED.** I did not
  restart docker or run compose. The reasoning: Docker currently has nothing in the filter table's
  OUTPUT chain, which held only ufw's six jumps before I added mine; its only OUTPUT rule is in the nat
  table (`! -d 127.0.0.0/8 -m addrtype --dst-type LOCAL -j DOCKER`), which runs before filter and only
  rewrites destinations into 172.x, which the chain also rejects. The watch timer is the backstop:
  within a minute, a displaced jump stops both runners.

### The deterministic pause for A2A-Hub deploys

Run as melvenac:
```
sudo gh-runners-pause [timeout-seconds, default 3600]    # prints "paused", exit 0, only after reading is-active back
sudo gh-runners-resume                                   # prints "resumed", exit 0, only after reading is-active back
```
- **pause never kills a running job.** It stops each runner as soon as that runner is idle, so an idle
  runner takes no new job while the other finishes.
- **How it knows a runner is busy:** the unit's cgroup holds a `Runner.Worker` process, which the runner
  starts once per job. A cgroup it cannot read counts as busy.
- **This was checked in both directions against GitHub's own `busy` field.** Mid-job, the cgroup held
  `bin/Runner.Worker spawnclient` while GitHub said `busy=true`. At idle, the cgroup held 0 workers while
  GitHub said `busy=false`.
- **On timeout** it prints `NOT paused … Nothing was killed.` and exits 1.
- **Limit:** in the milliseconds between the idle check and the stop, GitHub could assign a job, and the
  stop would then cancel it.
- **A pause does not survive a reboot.** Both units are enabled for boot.

**Demo, with both runners mid-job** (runs 36065208124 and 36065211981), output verbatim:
```
[22:03:46Z] waiting for a running job: gh-runner@1.service gh-runner@2.service
[22:04:37Z] gh-runner@1.service: idle, stopping
[22:04:37Z] waiting for a running job: gh-runner@2.service
[22:05:07Z] gh-runner@2.service: idle, stopping
  gh-runner@1.service: inactive
  gh-runner@2.service: inactive
[22:05:08Z] paused
pause exit=0
```
Both jobs finished **success**: tcm-1 completed at 22:04:36 and was stopped at 22:04:37; tcm-2 completed
at 22:05:04 and was stopped at 22:05:07. Then:
```
  gh-runner@1.service: active
  gh-runner@2.service: active
[22:10:21Z] resumed
resume exit=0
```
GitHub then showed `tcm-1 online` and `tcm-2 online`. `gh-runners-resume` was also used to restore the
runners in fail-closed proof 2.

## 5. How to remove it (exact commands)

On this machine:
```
gh api -X DELETE repos/melvenac/Self-Improving-Agent/actions/runners/22
gh api -X DELETE repos/melvenac/Self-Improving-Agent/actions/runners/23
```
On tcm (`ssh melvenac@100.124.212.87`):
```
sudo systemctl disable --now gh-runner-egress-watch.timer gh-runner@1.service gh-runner@2.service
sudo systemctl disable --now gh-runner-egress.service      # its ExecStop deletes the jumps and chains
sudo rm /etc/systemd/system/gh-runner@.service /etc/systemd/system/gh-runner-egress.service \
        /etc/systemd/system/gh-runner-egress-watch.service /etc/systemd/system/gh-runner-egress-watch.timer \
        /usr/local/sbin/gh-runner-egress /usr/local/sbin/gh-runners-pause /usr/local/sbin/gh-runners-resume
sudo systemctl daemon-reload
sudo userdel -r gh-runner                                   # also removes /srv/gh-runner
sudo iptables -S | grep GH_RUNNER; sudo ip6tables -S | grep GH_RUNNER   # expect no output
```
If the `ci.yml` switch has been merged, revert that commit first, or PR checks will queue for runners
that no longer exist.

## 6. The ci.yml switch (PR #152; Aaron merges)

- **Pushes to `master` still run on `ubuntu-latest`.** Everything else (pull requests, dispatches) runs on
  `[self-hosted, linux, tcm]`, so on whichever of tcm-1 and tcm-2 is free.
- A dispatch input `hosted: true` forces `ubuntu-latest`, the fallback when tcm is down. It was exercised
  by run 36065215334.
- An egress self-check step runs only on the self-hosted runners (`runner.environment == 'self-hosted'`).
- `ci-tcm.yml` is deleted, because it was the proof and is superseded.
- **For D-032's merge gate:** the workflow is still `CI` and the job still `test`, so the check's name
  does not change. What changes is where it runs.
- **If tcm is down (or paused), a PR's `test` check sits queued and the PR never reaches CLEAN**, so
  D-032 merges wait. The way out is to cancel the queued run and dispatch `ci.yml` with `hosted: true`.
  Whether that dispatched run satisfies the PR's check is **NOT VERIFIED**.
- Two runners: at most two PR runs at a time, and the rest queue.
- T-178 (push triggers on seat branches) is not part of this change. If it lands, those pushes also run
  on tcm under this expression.

## 7. What was not verified

- **A reboot.** Everything is enabled for boot, and the unit ordering puts the firewall before the
  runners (`After=ufw.service docker.service`). Nothing has been observed across a reboot. That is
  Aaron's call.
- **The jump's position after Docker or ufw rewrite their chains** (section 4). The watch timer is the
  backstop.
- **Per-runner CPU use during the parallel jobs** (section 3), and whether the hub stays responsive
  under a longer or heavier load than one suite each. One sample: 4 ms to connect.
- **Memory pressure:** neither `MemoryMax` nor `OOMScoreAdjust` has been exercised by a real
  shortage. The values are read back from systemd, not observed in action.
- **The isolation table was re-read inside the first design's unit only.** The template carries the same
  lines, and each D-044 job denied `/opt/doorctl` from inside itself, but I did not re-run the full table
  inside `@1`/`@2`.
- **The runner's self-update.** It is left enabled, the default. An update writes only under
  `/srv/gh-runner`, which the units allow, but none has happened yet.
- **The master-push path of the `ci.yml` expression**, which needs a merge.
- **A dispatched `hosted: true` run satisfying a PR's pending check** (section 6).

## 8. Findings for Aaron (none of them mine to change)

1. **`/opt/doorctl` and `/var/lib/doorctl` are world-readable**, and the latter holds **`door.db`**. Any
   local account can read the door-access database today. The runners cannot (section 2), but the user
   `maker` (uid 1001) and any future account can.
2. **The printers are not OctoPrint.** They are two Klipper/Moonraker/Mainsail stacks (`prind`,
   `kingroon`) behind traefik on 0.0.0.0:80 and :81. ufw still has rules commented "octoprint" on
   5000/5001, where nothing listens. The tcm reference note and the brief carry the old fact.
3. **Moonraker's API is reachable from any local account** through :80/:81, so any local account can
   command the printers.
4. **`/sync` in this tree reports one issue that is on master (f82bfe5), not in this change:**
   `retirements`, where `.agents/SYSTEM/ENTITIES.md` still names `dream` and `reflection queue`, both
   retired on 2026-09-15.
5. **Claude Code's auto mode re-engaged in this window after Aaron had switched it off once.** That is why
   the second classifier stop happened. If a later tcm session is meant to run under manual approval,
   check the mode at its start.
