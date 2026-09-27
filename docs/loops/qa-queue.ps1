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
#
# Two queues on one machine cannot overlap. A lock file (%USERPROFILE%\sia-qa-queue\queue.lock) is created
# exclusively, holds this process's pid and start time, and is removed on exit. A second queue refuses, naming the
# holder, before any fetch or checkout. A stale lock (that pid is gone, or the pid's start time differs) is taken
# over and the takeover is logged. This does not consult WMI CommandLine: a null CommandLine is what let a second
# queue move the tree under a running driver on 2026-09-27.
param(
  [Parameter(Mandatory = $true)] [string] $Queue,  # e.g. "130,132" or "130 132": TEXT, split below. As int[] under
                                                  # -File, "130,132" arrived as the one number 130132 (2026-09-26).
  [int] $TimeoutMinutes = 300,      # one QA run longer than this is killed (with its process tree) and recorded
  [int] $QuietCpuPercent = 35,      # before each run, wait for the machine to be quiet: average CPU below this
  [int] $QuietWaitMinutes = 120,    # ... for at most this long; then run anyway, and record that it was busy
  [string] $Checkout = '',          # optional: the commit to move the tree to, after any running driver finishes
  [int] $StartWaitMinutes = 480,    # how long -Checkout waits for a hand-launched driver to finish
  [switch] $SelfTest                # classify CommandLine shapes and exit; no lock, no git, no driver
)

$ErrorActionPreference = 'Continue'

# A powershell.exe we cannot prove is not a driver counts as one. $selfId is excluded so a queue whose own
# CommandLine is unreadable does not wait on itself.
function Get-OtherDriverHitsFrom($procs, [int] $selfId) {
  $hits = New-Object System.Collections.Generic.List[object]
  foreach ($p in @($procs)) {
    if ($null -eq $p) { continue }
    $procId = 0
    try { $procId = [int]$p.ProcessId } catch { continue }
    if ($procId -eq $selfId) { continue }
    $cl = [string]$p.CommandLine
    if ([string]::IsNullOrWhiteSpace($cl)) {
      $hits.Add([pscustomobject]@{ ProcessId = $procId; Why = 'commandline_unreadable' })
    } elseif ($cl -match 'docs[\\/]loops[\\/]qa-\d+[\\/]drive\.ps1') {
      $hits.Add([pscustomobject]@{ ProcessId = $procId; Why = 'driver' })
    }
  }
  return $hits.ToArray()
}

function Get-OtherDriverHits {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue)
  return @(Get-OtherDriverHitsFrom $procs $PID)
}

if ($SelfTest) {
  $fails = 0
  function Check([string] $name, [bool] $ok) {
    if ($ok) { Write-Output "selftest $name=pass" } else { Write-Output "selftest $name=fail"; $script:fails++ }
  }
  $driver = [pscustomobject]@{ ProcessId = 11; CommandLine = 'powershell -File C:\qa\docs\loops\qa-134\drive.ps1' }
  $driverSlash = [pscustomobject]@{ ProcessId = 12; CommandLine = 'powershell -File C:/qa/docs/loops/qa-9997/drive.ps1' }
  $nullCl = [pscustomobject]@{ ProcessId = 13; CommandLine = $null }
  $emptyCl = [pscustomobject]@{ ProcessId = 14; CommandLine = '' }
  $blankCl = [pscustomobject]@{ ProcessId = 15; CommandLine = '   ' }
  $queueCl = [pscustomobject]@{ ProcessId = 16; CommandLine = 'powershell -File C:\Users\Aaron Melven\qa-queue.ps1 -Queue 134' }
  $self = [pscustomobject]@{ ProcessId = 17; CommandLine = $null }
  $hits = @(Get-OtherDriverHitsFrom @($driver, $driverSlash, $nullCl, $emptyCl, $blankCl, $queueCl, $self) 17)
  Check 'driver' (@($hits | Where-Object { $_.ProcessId -eq 11 -and $_.Why -eq 'driver' }).Count -eq 1)
  Check 'driver_slash' (@($hits | Where-Object { $_.ProcessId -eq 12 -and $_.Why -eq 'driver' }).Count -eq 1)
  Check 'unreadable_null' (@($hits | Where-Object { $_.ProcessId -eq 13 -and $_.Why -eq 'commandline_unreadable' }).Count -eq 1)
  Check 'unreadable_empty' (@($hits | Where-Object { $_.ProcessId -eq 14 -and $_.Why -eq 'commandline_unreadable' }).Count -eq 1)
  Check 'unreadable_blank' (@($hits | Where-Object { $_.ProcessId -eq 15 -and $_.Why -eq 'commandline_unreadable' }).Count -eq 1)
  Check 'queue_script_ignored' (@($hits | Where-Object { $_.ProcessId -eq 16 }).Count -eq 0)
  Check 'self_excluded' (@($hits | Where-Object { $_.ProcessId -eq 17 }).Count -eq 0)
  $live = @(Get-OtherDriverHits)
  Check 'live_query_ran' ($null -ne $live)
  if ($fails -eq 0) { Write-Output 'selftest ok'; exit 0 }
  Write-Output "selftest fails=$fails"
  exit 1
}

$tree = Join-Path $env:USERPROFILE 'Worktrees\sia-qa'
$logDir = Join-Path $env:USERPROFILE 'sia-qa-queue'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'queue.log'
$script:QueueLockPath = Join-Path $logDir 'queue.lock'
$script:QueueLock = $null
$script:QueueLockStamp = $null

function L([string] $k, [string] $v) { "$((Get-Date).ToUniversalTime().ToString('o')) $k=$v" | Add-Content $log -Encoding utf8 }

function Get-ProcessStartStamp([int] $procId) {
  try {
    $proc = Get-Process -Id $procId -ErrorAction Stop
  } catch {
    return @{ state = 'gone'; start = $null; error = "$_" }
  }
  try {
    $start = $proc.StartTime.ToUniversalTime().ToString('o')
    return @{ state = 'seen'; start = $start; error = $null }
  } catch {
    return @{ state = 'unknown'; start = $null; error = "$_" }
  }
}

function Read-QueueLock([string] $path) {
  $text = $null
  try {
    $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      $sr = New-Object System.IO.StreamReader($fs)
      $text = $sr.ReadToEnd()
    } finally {
      $fs.Dispose()
    }
  } catch {
    return @{ procId = $null; start = $null; error = "$_" }
  }
  $holderId = $null
  $start = $null
  foreach ($line in ($text -split '\r?\n')) {
    if ($line -match '^pid=(\d+)$') { $holderId = [int]$Matches[1] }
    elseif ($line -match '^start=(.+)$') { $start = $Matches[1] }
  }
  return @{ procId = $holderId; start = $start; error = $null }
}

# live means "do not take this lock". A pid we cannot inspect is live: taking it could overlap a driver
# Windows did not let us see.
function Test-LockHolder($holder) {
  if ($null -eq $holder.procId) { return @{ live = $false; reason = 'unreadable_lock' } }
  $stamp = Get-ProcessStartStamp ([int]$holder.procId)
  if ($stamp.state -eq 'gone') { return @{ live = $false; reason = 'pid_gone' } }
  if ($stamp.state -ne 'seen') { return @{ live = $true; reason = 'start_unreadable' } }
  if ($stamp.start -ne [string]$holder.start) { return @{ live = $false; reason = 'start_changed' } }
  return @{ live = $true; reason = 'held' }
}

function Acquire-QueueLock {
  $path = $script:QueueLockPath
  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    try {
      $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)
      $script:QueueLock = $fs
      $stamp = Get-ProcessStartStamp $PID
      if ($stamp.state -ne 'seen') {
        L 'refuse' "could not read own start time ($($stamp.error)); not starting"
        exit 1
      }
      $script:QueueLockStamp = $stamp.start
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("pid=$PID`r`nstart=$($stamp.start)`r`n")
      $fs.Write($bytes, 0, $bytes.Length)
      $fs.Flush($true)
      return
    } catch {
      $inner = $_.Exception
      while ($inner.InnerException) { $inner = $inner.InnerException }
      if (-not ($inner -is [System.IO.IOException]) -or -not (Test-Path -LiteralPath $path)) {
        L 'refuse' "queue lock create failed: $inner"
        exit 1
      }
      $holder = Read-QueueLock $path
      $kind = Test-LockHolder $holder
      if ($kind.live) {
        L 'refuse' "queue lock held by pid=$($holder.procId) start=$($holder.start) reason=$($kind.reason)"
        exit 1
      }
      L 'takeover' "stale lock pid=$($holder.procId) start=$($holder.start) reason=$($kind.reason)"
      try {
        Remove-Item -LiteralPath $path -Force -ErrorAction Stop
      } catch {
        L 'refuse' "stale lock pid=$($holder.procId) start=$($holder.start) could not be removed ($_); not overlapping a holder this process cannot see"
        exit 1
      }
    }
  }
  L 'refuse' 'queue lock could not be acquired'
  exit 1
}

function Release-QueueLock {
  $fs = $script:QueueLock
  $script:QueueLock = $null
  if (-not $fs) { return }
  $mine = $script:QueueLockStamp
  $fs.Dispose()
  $holder = Read-QueueLock $script:QueueLockPath
  if ($holder.procId -eq $PID -and $holder.start -eq $mine) {
    Remove-Item -LiteralPath $script:QueueLockPath -Force -ErrorAction SilentlyContinue
  }
}

function Wait-OtherDrivers([string] $where, [datetime] $deadline) {
  while ($true) {
    # @() so a single hit stays a collection. A bare one-item return is one object, and a
    # later edit that reads .Count on the bare return is how a lone driver becomes invisible.
    $hits = @(Get-OtherDriverHits | Where-Object { $_ -and $_.ProcessId })
    if ($hits.Count -eq 0) { return $true }
    $detail = (@($hits | ForEach-Object { "pid=$($_.ProcessId) $($_.Why)" })) -join ','
    if ((Get-Date) -ge $deadline) {
      L 'wait' "$where still_present $detail"
      return $false
    }
    L 'wait' "$where $detail"
    Start-Sleep -Seconds 60
  }
}

try {
  # Before any fetch or checkout, including when the queue text itself is bad.
  Acquire-QueueLock

  $items = @($Queue -split '[,\s]+' | Where-Object { $_ -ne '' })
  $bad = @($items | Where-Object { $_ -notmatch '^\d+$' })
  if ($bad.Count -gt 0 -or $items.Count -eq 0) { L 'abort' "queue '$Queue' is not a list of record numbers"; exit 1 }
  $Queue = $items -join ','
  L 'start' "queue=$Queue checkout=$Checkout machine=$env:COMPUTERNAME timeout_min=$TimeoutMinutes"

  Set-Location $tree

  # -Checkout: move the tree only AFTER any running driver has finished, so a QA seat already at work (launched by hand)
  # never has its files changed under it. The SHA is Aaron's, given at launch, like the list.
  if ($Checkout) {
    $w = (Get-Date).AddMinutes($StartWaitMinutes)
    if (-not (Wait-OtherDrivers 'checkout' $w)) {
      L 'abort' "a driver was still running after $StartWaitMinutes min; the tree was not moved"
      exit 1
    }
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

  foreach ($n in $plan) {
    # 1. Another driver (launched by hand, outside this queue) must finish first: QA seats never run side by side.
    $deadline = (Get-Date).AddMinutes($QuietWaitMinutes)
    if (-not (Wait-OtherDrivers "before.$n" $deadline)) {
      L "skip.$n" 'another QA driver was still running after the wait'
      continue
    }

    # 2. Wait for quiet, so a developer seat or Aaron's own work does not skew the run. Record what it was either way.
    $cpu = Get-CpuAverage
    while ($cpu -ge $QuietCpuPercent -and (Get-Date) -lt $deadline) {
      L 'wait' "cpu.$n averaged $cpu percent >= $QuietCpuPercent"
      Start-Sleep -Seconds 60
      $cpu = Get-CpuAverage
    }
    L "cpu_at_start.$n" $cpu
    if ($cpu -ge $QuietCpuPercent) { L "busy.$n" "ran although CPU averaged $cpu% (>= $QuietCpuPercent) after the wait" }

    # 3. The tree must still be at the launch commit. QA seats commit from their own scratch worktrees, but if one moved
    #    this HEAD, put it back. Untracked report copies are left alone.
    $now = (git rev-parse HEAD).Trim()
    if ($now -ne $head) { L "head_moved.$n" "$now; restoring $head"; git checkout -q --detach $head }

    # 4. Run the driver and wait, with a hard limit.
    $driver = Join-Path $tree "docs\loops\qa-$n\drive.ps1"
    L "run.$n" 'started'
    # QUOTE the path: Start-Process joins -ArgumentList with spaces and does not quote, and the QA PC's profile is
    # 'C:\Users\Aaron Melven', so an unquoted path was cut at the space and powershell exited -196608 (2026-09-26).
    $p = Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $driver + '"')) -PassThru -WindowStyle Hidden
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
} finally {
  Release-QueueLock
}
