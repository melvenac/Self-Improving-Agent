# Infra: the self-hosted runner on tcm — developer handoff

**By:** Forge (developer seat), **record session 97**, 2026-09-24, in `~/Worktrees/sia-infra`.
**For:** Atlas (planner), record session 90, and Aaron through the planner (D-038).
**Brief:** `docs/loops/infra-tcm-runner-brief.md` (at the time of writing, in the planner's tree only).
**Model and effort:** Claude Opus 5.5 (1M context), effort **low** (the harness setting; the planner has
flagged it to Aaron as worth raising for firewall work).

## Authority, as it was used

- **D-043, quoted in the brief (Aaron to the planner, 2026-09-24):** "yes, set it up now"; "TCM server is
  not used much at all. For now it's only being used for the hub dev. Ready for sia infra?"
- **The planner's GO for step 2 (A to D, as written), relayed by A2A**, with one required addition: a
  fail-closed check, which is below. The planner also approved the IPv6 change (reject all IPv6).
- **Relay (A2A-Hub's planner), relayed by the planner:** no objection to A to D. Its requirements are
  covered in section 4.
- **A host-level stop, cleared by Aaron himself in this window.** Writing the systemd units was denied by
  Claude Code's auto-mode classifier ("Unauthorized Persistence"). I stopped, told the planner, and did not
  look for another route. Aaron then said in this session, verbatim: **"go ahead, I have this session in
  manual mode"**. Everything on tcm was installed after that message.

## 1. What was installed, where, and as which user

All on tcm (Ubuntu 24.04.4, 4 cores, 15 GiB). Copies of every file, **byte-identical to the installed
ones** (sha256 compared at the time of writing), are in `docs/loops/infra-tcm-runner/`.

| What | Where | Owner |
|---|---|---|
| User `gh-runner` (system user, uid 999, gid 986, shell `/usr/sbin/nologin`, **no** sudo, groups: only its own) | home `/srv/gh-runner`, mode 0750 | — |
| actions/runner **v2.337.0**, sha256 `70920811…6613` (matches GitHub's published digest) | `/srv/gh-runner/runner` | gh-runner |
| Registered runner **`tcm`, id 21**, labels `self-hosted, Linux, X64, tcm` | repo `melvenac/Self-Improving-Agent` | — |
| `gh-runner-egress` (firewall script: apply / check / watch / remove) | `/usr/local/sbin/`, 0755 | root |
| `gh-runner-egress.service` (oneshot; applies the firewall at boot, removes it on stop) | `/etc/systemd/system/`, enabled | root |
| `gh-runner.service` (the runner) | `/etc/systemd/system/`, enabled | root (runs as gh-runner) |
| `gh-runner-egress-watch.service` + `.timer` (every minute) | `/etc/systemd/system/`, timer enabled | root |

The registration token went from `gh api` through ssh's stdin into `ACTIONS_RUNNER_INPUT_TOKEN`, so it was
never on a command line or in a file. The temporary install folder `/tmp/gh-runner-install` was deleted
afterwards.

## 2. The limits applied

**Resources** (read back with `systemctl show`): `CPUQuota=200%` (2 of 4 cores; read back as
`CPUQuotaPerSecUSec=2s`), `CPUWeight=20`, `IOWeight=20`, `Nice=10`, `MemoryMax=6G`. During the proof run the
runner used about 113% CPU and about 1 GB. The hub answered a connect on :4000 in 3 ms, and a2a-hub and
Convex were at 0.00% and 0.06% CPU.

**Isolation inside the unit:** `NoNewPrivileges`, `PrivateTmp`, `PrivateDevices`, `ProtectHome=yes`,
`ProtectSystem=strict` with `ReadWritePaths=/srv/gh-runner`, and
`InaccessiblePaths=/opt/doorctl /var/lib/doorctl /etc/doorctl /run/docker.sock`. Tested inside the running
unit's mount namespace as gh-runner, with the same test run OUTSIDE the unit as the positive control:

| Path | Inside the unit | Outside (control, same user) |
|---|---|---|
| `/opt/doorctl` | Permission denied | readable (`schema.sql`) |
| `/var/lib/doorctl` | Permission denied | **readable (`door.db`)** |
| `/etc/doorctl` | Permission denied | Permission denied |
| `/run/docker.sock` | `s--------- root:root`, connect refused | `srw-rw---- root:docker` |
| `/usr/local` (write) | Read-only file system | — |

My first version of that test used `ls -ld` and reported the masked paths as READABLE. That was the
instrument, not the isolation: it stats the mount point, and systemd's mask is a stat-able mode-000 node.
The table above uses real reads.

**Egress firewall.** A chain `GH_RUNNER` (IPv4 and IPv6), reached by one jump at **OUTPUT rule 1**:
`-m owner --uid-owner 999 -j GH_RUNNER`. It does **not** touch ufw's rules or files, and it did not reload
ufw.
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

The same probes, run as the first step of a real CI job on tcm, printed `blocked:` for all nine internal
targets and `denied: /opt/doorctl` (run 36062266765).

**Fail-closed, as the planner required:**
1. `ExecStartPre=+/usr/local/sbin/gh-runner-egress check`: the runner will not start unless the jump is
   OUTPUT rule 1 and the chain matches its snapshot, for IPv4 and IPv6. The snapshot is taken at apply
   time into `/run/gh-runner-egress/` (root only).
2. `gh-runner-egress-watch.timer` runs the same check every minute. On a failure it logs to the journal
   (`-t gh-runner-egress`, priority auth.crit) and runs `systemctl stop gh-runner.service`.
3. **The proof, from the tcm journal (UTC):**
   - 21:31:03: runner active, check OK. I removed the IPv4 jump by hand; OUTPUT rule 1 became `ufw-before-logging-output`.
   - 21:32:00: the watch logged `egress firewall check FAILED, stopping gh-runner.service: IPv4: OUTPUT rule 1 is not the gh-runner jump to GH_RUNNER`.
   - 21:32:01: runner `inactive`, **58 s after the removal**.
   - 21:32:01: `systemctl start gh-runner.service` with the jump still missing was refused (`start rc=1`; the ExecStartPre printed the same reason).
   - 21:32:01 to 21:32:07: `systemctl restart gh-runner-egress.service`, check OK, runner started. The jump was back at rule 1 for IPv4 and IPv6, and GitHub showed the runner `online`.

   The runner was idle, and no workflow targeted it, for the whole 58 s window.

## 3. The test run on tcm

Same SHA **4851c96**, both green:

| | tcm (self-hosted) | GitHub-hosted |
|---|---|---|
| Run | **36062266765** (push, `ci-tcm.yml`) | **36062316052** (dispatch, `ci.yml`) |
| Result | success | success |
| Tests | **1034 passed (1034)**, 71 files | **1034 passed (1034)**, 71 files |
| Per-file names and counts | identical (diffed, file by file) | |
| git | 2.43.0 | 2.55.0 |
| Node (setup-node) | v22.23.3 (the system node is v22.23.2 and was not used) | 22.x (not printed) |
| Job wall time | **2m21s** (21:33:48 to 21:36:09) | **1m47s** (21:34:18 to 21:36:05) |
| Test step | 71 s (vitest 70.12 s) | 86 s (vitest 84.92 s) |
| setup-node + its post step | 25 s + 11 s (first run: Node download, cold npm cache) | 3 s + 0 s |
| Egress self-check | 9 s | — |

The logs show 131 and 135 `✓` lines. The difference is vitest's slow-test lines, 60 vs 64, which depend on
machine speed. The per-file lines are identical.

## 4. Relay's requirements

- **Ports 4000, 3210 and 3211:** the runner binds nothing and only makes outbound connections.
- **Left alone:** `~/data/convex-data`, `~/projects/a2a-hub*`, the images, `~/docker-compose/a2a-hub`
  (and its .env), and any `~/.a2a-hub/keys` (none exists). The runner cannot reach them in any case:
  `/home/melvenac` is 0750, and `ProtectHome=yes` hides `/home`.
- **(3a) The owner-matched block:** done, and wider than asked (section 2), because 127.0.0.1 alone
  would have left Convex and the hub reachable over the docker bridge and the hub on every host address.
  Proven in both directions.
- **(3b) Trusted workflows only:** the repo is **private**. `run_workflows_from_fork_pull_requests=false`,
  `send_secrets_and_variables=false`, `send_write_tokens_to_workflows=false`,
  `require_approval_for_fork_pr_workflows=false`. The contributor-approval endpoint answers 422 "Fork PR
  approval is not allowed for private repositories". `allow_forking=true`, but a fork's PRs run no
  workflows.
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
  within a minute, a displaced jump stops the runner.

## 5. How to remove it (exact commands)

On this machine:
```
gh api -X DELETE repos/melvenac/Self-Improving-Agent/actions/runners/21
```
On tcm (`ssh melvenac@100.124.212.87`):
```
sudo systemctl disable --now gh-runner-egress-watch.timer gh-runner.service
sudo systemctl disable --now gh-runner-egress.service      # its ExecStop deletes the jumps and chains
sudo rm /etc/systemd/system/gh-runner.service /etc/systemd/system/gh-runner-egress.service \
        /etc/systemd/system/gh-runner-egress-watch.service /etc/systemd/system/gh-runner-egress-watch.timer \
        /usr/local/sbin/gh-runner-egress
sudo systemctl daemon-reload
sudo userdel -r gh-runner                                   # also removes /srv/gh-runner
sudo iptables -S | grep GH_RUNNER; sudo ip6tables -S | grep GH_RUNNER   # expect no output
```
If the `ci.yml` switch has been merged, revert that commit first, or PR checks will queue for a runner
that no longer exists.

## 6. The ci.yml switch (proposed in a PR on this branch; Aaron merges)

- **Pushes to `master` still run on `ubuntu-latest`.** Everything else (pull requests, dispatches) runs on
  `[self-hosted, linux, tcm]`.
- A dispatch input `hosted: true` forces `ubuntu-latest`. That is the fallback when tcm is down.
- An egress self-check step runs only on the self-hosted runner (`runner.environment == 'self-hosted'`).
- `ci-tcm.yml` is deleted, because it was the proof and is superseded.
- **For D-032's merge gate:** the workflow is still `CI` and the job still `test`, so the check's name
  does not change. What changes is where it runs. **If tcm is offline, a PR's `test` check sits queued
  and the PR never reaches CLEAN**, so D-032 merges wait. The way out is to cancel the queued run and
  dispatch `ci.yml` with `hosted: true`. Whether a dispatched run satisfies the PR's check is **NOT
  VERIFIED**.
- One runner means PR runs **queue** one at a time.
- T-178 (push triggers on seat branches) is not part of this change. If it lands, those pushes also run
  on tcm under this expression.

## 7. What was not verified

- **A reboot.** Everything is enabled for boot, and the unit ordering puts the firewall before the
  runner (`After=ufw.service docker.service`). Nothing has been observed across a reboot. That is Aaron's
  call.
- **The jump's position after Docker or ufw rewrite their chains** (section 4). The watch timer is the
  backstop.
- **Warm-cache wall time on tcm.** Only the first run exists, and it paid for the Node download and a
  cold npm cache.
- **The runner's self-update.** It is left enabled, the default. An update writes only under
  `/srv/gh-runner`, which the unit allows, but none has happened yet.
- **The master-push path of the expression**, which needs a merge. The `hosted: true` path is exercised
  by a dispatch on this branch; see the PR.

## 8. Findings for Aaron (none of them mine to change)

1. **`/opt/doorctl` and `/var/lib/doorctl` are world-readable**, and the latter holds **`door.db`**. Any
   local account can read the door-access database today. The runner cannot (section 2), but the user
   `maker` (uid 1001) and any future account can.
2. **The printers are not OctoPrint.** They are two Klipper/Moonraker/Mainsail stacks (`prind`,
   `kingroon`) behind traefik on 0.0.0.0:80 and :81. ufw still has rules commented "octoprint" on
   5000/5001, where nothing listens. The tcm reference note and the brief carry the old fact.
3. **Moonraker's API is reachable from any local account** through :80/:81, so any local account can
   command the printers.
4. **`/sync` in this tree reports one issue that is on master (f82bfe5), not in this change:**
   `retirements`, where `.agents/SYSTEM/ENTITIES.md` still names `dream` and `reflection queue`, both
   retired on 2026-09-15.
