# qa-queue.ps1: run a FIXED list of QA drivers one after another, unattended (Aaron's overnight window, 2026-09-26).
#
# Aaron launches it ONCE, with the list: the list is the approval. The runner never reads a list from anywhere else
# and never picks up new entries, so it cannot become a way for another seat to start Claude runs on this machine.
# The planner is refused that launch by the host classifier, and this script does not route around it: every run in
# it was named by Aaron at launch.
#
# Usage (from the QA checkout, after moving it to a commit that carries every listed driver):
#   powershell -NoProfile -ExecutionPolicy Bypass -File docs\loops\qa-queue.ps1 -Queue 130,132
# It works on any machine with the QA layout: %USERPROFILE%\Worktrees\sia-qa, and claude.exe as the driver finds it.
#
# Everything it observes goes to %USERPROFILE%\sia-qa-queue\queue.log (key=value lines), and each driver still writes
# its own %USERPROFILE%\sia-qaN\ folder.
param(
  [Parameter(Mandatory = $true)] [string] $Queue,  # e.g. "130,132" or "130 132": TEXT, split below. As int[] under
                                                  # -File, "130,132" arrived as the one number 130132 (2026-09-26).
  [int] $TimeoutMinutes = 300,      # one QA run longer than this is killed (with its process tree) and recorded
  [int] $QuietCpuPercent = 35,      # before each run, wait for the machine to be quiet: average CPU below this
  [int] $QuietWaitMinutes = 120,    # ... for at most this long; then run anyway, and record that it was busy
  [string] $Checkout = '',          # optional: the commit to move the tree to, after any running driver finishes
  [int] $StartWaitMinutes = 480     # how long -Checkout waits for a hand-launched driver to finish
)

$ErrorActionPreference = 'Continue'
$tree = Join-Path $env:USERPROFILE 'Worktrees\sia-qa'
$logDir = Join-Path $env:USERPROFILE 'sia-qa-queue'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'queue.log'
function L([string] $k, [string] $v) { "$((Get-Date).ToUniversalTime().ToString('o')) $k=$v" | Add-Content $log -Encoding utf8 }

Set-Location $tree
$items = @($Queue -split '[,\s]+' | Where-Object { $_ -ne '' })
$bad = @($items | Where-Object { $_ -notmatch '^\d+$' })
if ($bad.Count -gt 0 -or $items.Count -eq 0) { L 'abort' "queue '$Queue' is not a list of record numbers"; exit 1 }
$Queue = $items -join ','
L 'start' "queue=$($Queue -join ',') checkout=$Checkout machine=$env:COMPUTERNAME timeout_min=$TimeoutMinutes"

function Get-OtherDrivers { @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'docs[\\/]loops[\\/]qa-\d+[\\/]drive\.ps1' }) }

# -Checkout: move the tree only AFTER any running driver has finished, so a QA seat already at work (launched by hand)
# never has its files changed under it. The SHA is Aaron's, given at launch, like the list.
if ($Checkout) {
  $w = (Get-Date).AddMinutes($StartWaitMinutes)
  while ((Get-OtherDrivers).Count -gt 0 -and (Get-Date) -lt $w) { Start-Sleep 60 }
  if ((Get-OtherDrivers).Count -gt 0) { L 'abort' "a driver was still running after $StartWaitMinutes min; the tree was not moved"; exit 1 }
  git fetch -q origin
  git checkout -q --detach $Checkout
  if ($LASTEXITCODE -ne 0) { L 'abort' "checkout of $Checkout failed"; exit 1 }
}
$head = (git rev-parse HEAD).Trim()
L 'head' $head

# Every listed driver must be TRACKED at the launch commit. A driver that is not is skipped, never fetched.
$plan = foreach ($n in $items) {
  $rel = "docs/loops/qa-$n/drive.ps1"
  git cat-file -e "HEAD:$rel" 2>$null
  if ($LASTEXITCODE -eq 0) { $n } else { L "skip.$n" "not tracked at $head ($rel)" }
}

function Get-CpuAverage { $s = 1..5 | ForEach-Object { (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average; Start-Sleep 2 }; [math]::Round(($s | Measure-Object -Average).Average, 1) }
function Get-OtherDrivers { @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'docs[\\/]loops[\\/]qa-\d+[\\/]drive\.ps1' }) }

foreach ($n in $plan) {
  # 1. Another driver (launched by hand, outside this queue) must finish first: QA seats never run side by side.
  $deadline = (Get-Date).AddMinutes($QuietWaitMinutes)
  while ((Get-OtherDrivers).Count -gt 0 -and (Get-Date) -lt $deadline) { Start-Sleep 60 }
  if ((Get-OtherDrivers).Count -gt 0) { L "skip.$n" 'another QA driver was still running after the wait'; continue }

  # 2. Wait for quiet, so a developer seat or Aaron's own work does not skew the run. Record what it was either way.
  $cpu = Get-CpuAverage
  while ($cpu -ge $QuietCpuPercent -and (Get-Date) -lt $deadline) { Start-Sleep 60; $cpu = Get-CpuAverage }
  L "cpu_at_start.$n" $cpu
  if ($cpu -ge $QuietCpuPercent) { L "busy.$n" "ran although CPU averaged $cpu% (>= $QuietCpuPercent) after the wait" }

  # 3. The tree must still be at the launch commit. QA seats commit from their own scratch worktrees, but if one moved
  #    this HEAD, put it back. Untracked report copies are left alone.
  $now = (git rev-parse HEAD).Trim()
  if ($now -ne $head) { L "head_moved.$n" "$now; restoring $head"; git checkout -q --detach $head }

  # 4. Run the driver and wait, with a hard limit.
  $driver = Join-Path $tree "docs\loops\qa-$n\drive.ps1"
  L "run.$n" 'started'
  $p = Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $driver -PassThru -WindowStyle Hidden
  if (-not $p.WaitForExit($TimeoutMinutes * 60 * 1000)) {
    L "timeout.$n" "killed after $TimeoutMinutes min (pid $($p.Id), process tree)"
    taskkill /PID $p.Id /T /F | Out-Null
  } else {
    L "exit.$n" $p.ExitCode
  }

  # 5. What the driver itself recorded.
  $out = Join-Path $env:USERPROFILE "sia-qa$n"
  L "done_marker.$n" (Test-Path (Join-Path $out 'done'))
  $meta = Join-Path $out 'drive.meta'
  if (Test-Path $meta) { $c = Get-Content $meta | Where-Object { $_ -match '^(completion|refusal|result)' } | Select-Object -Last 3; L "driver.$n" ($c -join ' | ') }
}
L 'end' 'queue finished'
