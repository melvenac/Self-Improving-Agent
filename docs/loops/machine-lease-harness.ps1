# T-204 harness: proves machine-lease.ps1 and the lease/verdict changes in qa-queue.ps1 against REAL processes.
# Nothing here touches the real %USERPROFILE%: the harness points USERPROFILE at a temp profile whose path has a
# space (the QA PC's does), copies the scripts under test into it, and uses a stub driver that never runs claude.
#
#   -Lease  the machine-lease.ps1 under test        -Queue  the qa-queue.ps1 under test
#   -OldQueue (optional) the pre-T-204 qa-queue.ps1: run the queue rows against it too and expect them RED.
#   -Rounds  race rounds (default 20)
# Prints `row.<name>=pass|FAIL <why>` lines and `summary passed=N failed=M`. Exit 1 when any row fails.
# A mutant is run by pointing -Lease or -Queue at the edited product file; nothing in the product exists for this.
param(
  [Parameter(Mandatory = $true)] [string] $Lease,
  [Parameter(Mandatory = $true)] [string] $Queue,
  [string] $OldQueue = '',
  [int] $Rounds = 20,
  [string] $Only = ''
)
$ErrorActionPreference = 'Stop'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$root = Join-Path $env:TEMP 't204-harness'
$profileDir = Join-Path $root 'Aaron Melven'
$realProfile = $env:USERPROFILE
$leasePath = Join-Path $profileDir 'machine-lease\lease.json'
$qLog = Join-Path $profileDir 'sia-qa-queue\queue.log'
$results = New-Object System.Collections.Generic.List[object]
$holders = New-Object System.Collections.Generic.List[object]

if (Test-Path $root) { Remove-Item -LiteralPath $root -Recurse -Force }
New-Item -ItemType Directory -Force $profileDir | Out-Null
$env:USERPROFILE = $profileDir

function Row([string] $name, [bool] $ok, [string] $why) {
  if ($Only -and $name -notlike "$Only*") { return }
  $results.Add([pscustomobject]@{ name = $name; ok = $ok })
  Write-Output ("row.$name=" + $(if ($ok) { 'pass' } else { "FAIL $why" }))
}

function Invoke-Lease([string[]] $argv) {
  $out = @(& $ps -NoProfile -ExecutionPolicy Bypass -File $Lease @argv 2>&1 | ForEach-Object { "$_" })
  return @{ code = $LASTEXITCODE; text = ($out -join "`n") }
}

function New-Holder {
  $p = Start-Process $ps -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 900') -PassThru -WindowStyle Hidden
  $holders.Add($p); Start-Sleep -Milliseconds 300
  return $p
}

function Clear-Lease { Remove-Item -LiteralPath (Split-Path $leasePath) -Recurse -Force -ErrorAction SilentlyContinue }

function Stamp([int] $procId) { (Get-Process -Id $procId).StartTime.ToUniversalTime().ToString('o') }

function Write-RawLease([string] $text) {
  New-Item -ItemType Directory -Force (Split-Path $leasePath) | Out-Null
  [System.IO.File]::WriteAllText($leasePath, $text)
}

function Write-Lease([int] $ownerPid, [string] $pidStart, [datetime] $expires) {
  Write-RawLease (([pscustomobject][ordered]@{ owner_seat = 'fixture'; session = 's'; pid = $ownerPid; pid_start = $pidStart
    started = (Get-Date).ToUniversalTime().ToString('o'); expires = $expires.ToUniversalTime().ToString('o') }) | ConvertTo-Json -Compress)
}

try {
  # ---- helper rows -----------------------------------------------------------------------------------------
  $h1 = New-Holder
  $r = Invoke-Lease @('take', '-OwnerPid', $h1.Id, '-Seat', 'forge', '-Session', 'sess-1', '-TtlMinutes', '30')
  Row 'R0.take_free' ($r.code -eq 0 -and (Test-Path $leasePath)) "code=$($r.code) $($r.text)"

  $r = Invoke-Lease @('take', '-OwnerPid', $PID, '-Seat', 'qa-queue')
  Row 'R1.held_live_refused' ($r.code -eq 10 -and $r.text -match 'owner=forge' -and $r.text -match "pid=$($h1.Id)") "code=$($r.code) $($r.text)"

  $st = Invoke-Lease @('status')
  Row 'R1b.status_names_limit_and_owner' ($st.code -eq 10 -and $st.text -match 'per-user' -and $st.text -match 'owner=forge') "code=$($st.code) $($st.text)"

  Clear-Lease
  $short = Start-Process $ps -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 900') -PassThru -WindowStyle Hidden
  Start-Sleep -Milliseconds 300
  $null = Invoke-Lease @('take', '-OwnerPid', $short.Id, '-Seat', 'dead')
  taskkill /PID $short.Id /T /F | Out-Null; Start-Sleep -Milliseconds 500
  $r = Invoke-Lease @('take', '-OwnerPid', $h1.Id, '-Seat', 'forge')
  Row 'R2.pid_gone_reclaimed' ($r.code -eq 0 -and $r.text -match 'takeover=stale lease reason=pid_gone') "code=$($r.code) $($r.text)"

  Clear-Lease
  Write-Lease $h1.Id '2001-01-01T00:00:00.0000000Z' (Get-Date).AddMinutes(30)
  $r = Invoke-Lease @('take', '-OwnerPid', $PID, '-Seat', 'qa-queue')
  Row 'R3.reused_pid_reclaimed' ($r.code -eq 0 -and $r.text -match 'reason=pid_reused') "code=$($r.code) $($r.text)"

  Clear-Lease
  Write-Lease $h1.Id (Stamp $h1.Id) (Get-Date).AddMinutes(-5)
  $r = Invoke-Lease @('take', '-OwnerPid', $PID, '-Seat', 'qa-queue')
  Row 'R4.expired_live_pid_reclaimed' ($r.code -eq 0 -and $r.text -match 'reason=expired') "code=$($r.code) $($r.text)"

  # R5: several real processes race for one free lease, released together on a start barrier; exactly one may win.
  $bad = 0; $note = ''
  $raceOwner = New-Holder
  for ($i = 0; $i -lt $Rounds; $i++) {
    Clear-Lease
    New-Item -ItemType Directory -Force (Split-Path $leasePath) | Out-Null
    $go = (Get-Date).ToUniversalTime().AddSeconds(4).ToString('o')
    $procs = 1..6 | ForEach-Object {
      $outf = Join-Path $root "race-$i-$_.txt"
      $cmd = "`$t=[datetime]::Parse('$go',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime(); while((Get-Date).ToUniversalTime() -lt `$t){}; & '$Lease' take -OwnerPid $($raceOwner.Id) -Seat racer$_ *> '$outf'; exit `$LASTEXITCODE"
      Start-Process $ps -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cmd) -PassThru -WindowStyle Hidden
    }
    $procs | ForEach-Object { $_.WaitForExit() }
    $wins = @($procs | Where-Object { $_.ExitCode -eq 0 }).Count
    if ($wins -ne 1) { $bad++; if (-not $note) { $note = "round $i had $wins winners" } }
  }
  Row 'R5.concurrent_takers_one_winner' ($bad -eq 0) "$bad of $Rounds rounds had != 1 winner ($note)"

  Clear-Lease
  $cases = @(
    @{ n = 'malformed'; text = '{not json'; want = 'malformed json' },
    @{ n = 'empty'; text = ''; want = 'empty' },
    @{ n = 'missing_field'; text = '{"owner_seat":"x","session":"s","pid":1}'; want = 'missing field' }
  )
  foreach ($c in $cases) {
    Write-RawLease $c.text
    $r = Invoke-Lease @('take', '-OwnerPid', $PID, '-Seat', 'qa-queue')
    $same = ([System.IO.File]::ReadAllText($leasePath) -eq $c.text)
    Row "R6.$($c.n)_blocks_named" ($r.code -eq 11 -and $r.text -match [regex]::Escape($c.want) -and $same) "code=$($r.code) same=$same $($r.text)"
  }

  Clear-Lease
  $null = Invoke-Lease @('take', '-OwnerPid', $h1.Id, '-Seat', 'forge')
  $r = Invoke-Lease @('release', '-OwnerPid', $PID)
  Row 'R7.release_by_non_owner_refused' ($r.code -eq 12 -and (Test-Path $leasePath)) "code=$($r.code) exists=$(Test-Path $leasePath) $($r.text)"
  $r = Invoke-Lease @('release', '-OwnerPid', $h1.Id)
  Row 'R7b.release_by_owner' ($r.code -eq 0 -and -not (Test-Path $leasePath)) "code=$($r.code) $($r.text)"

  # R7c: a detached launcher takes as itself, then hands the lease to the job it created
  Clear-Lease
  $h2 = New-Holder
  $null = Invoke-Lease @('take', '-OwnerPid', $h1.Id, '-Seat', 'qa-headless')
  $r = Invoke-Lease @('renew', '-OwnerPid', $h1.Id, '-NewOwnerPid', $h2.Id, '-TtlMinutes', '30')
  taskkill /PID $h1.Id /T /F | Out-Null; Start-Sleep -Milliseconds 500
  $st = Invoke-Lease @('status')
  Row 'R7c.handover_survives_launcher_exit' ($r.code -eq 0 -and $st.code -eq 10 -and $st.text -match "pid=$($h2.Id)") "renew=$($r.code) status=$($st.code) $($st.text)"
  taskkill /PID $h2.Id /T /F | Out-Null; Start-Sleep -Milliseconds 500
  $st = Invoke-Lease @('status')
  Row 'R7d.job_exit_frees_the_lease' ($st.code -eq 0 -and $st.text -match 'stale: pid_gone') "status=$($st.code) $($st.text)"

  # ---- queue rows ------------------------------------------------------------------------------------------
  function New-StubTree {
    $tree = Join-Path $profileDir 'Worktrees\sia-qa'
    if (Test-Path $tree) { Remove-Item -LiteralPath $tree -Recurse -Force }
    New-Item -ItemType Directory -Force (Join-Path $tree 'docs\loops\qa-9997') | Out-Null
    $driver = @'
$dest = Join-Path $env:USERPROFILE "sia-qa9997"
New-Item -ItemType Directory -Force $dest | Out-Null
Set-Content (Join-Path $dest "alive") $PID
Copy-Item (Join-Path $env:USERPROFILE "meta-fixture.txt") (Join-Path $dest "drive.meta") -Force
$errFix = Join-Path $env:USERPROFILE "err-fixture.txt"
if (Test-Path $errFix) { Copy-Item $errFix (Join-Path $dest "run-1.err") -Force }
Set-Content (Join-Path $dest "done") "1"
'@
    Set-Content -LiteralPath (Join-Path $tree 'docs\loops\qa-9997\drive.ps1') -Value $driver -Encoding ascii
    & git -C $tree init -q
    & git -C $tree add -A
    & git -C $tree -c user.email=t204@example.com -c user.name=t204 -c commit.gpgsign=false commit -q -m stub
  }

  function Reset-QueueState {
    foreach ($d in 'sia-qa-queue', 'sia-qa9997') { Remove-Item -LiteralPath (Join-Path $profileDir $d) -Recurse -Force -ErrorAction SilentlyContinue }
    Remove-Item (Join-Path $profileDir 'meta-fixture.txt'), (Join-Path $profileDir 'err-fixture.txt') -Force -ErrorAction SilentlyContinue
    Clear-Lease
  }

  function Invoke-Queue([string] $script, [string[]] $extra = @()) {
    Copy-Item -LiteralPath $script -Destination (Join-Path $profileDir 'qa-queue.ps1') -Force
    # The pre-T-204 queue has no -LeaseWaitMinutes; passing it would fail the binding, not test the lease.
    if ((Get-Content -LiteralPath $script -Raw) -notmatch 'LeaseWaitMinutes') { $extra = @() }
    $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $profileDir 'qa-queue.ps1') + '"'), '-Queue', '9997',
      '-QuietCpuPercent', '101', '-QuietWaitMinutes', '0', '-TimeoutMinutes', '2') + $extra
    $p = Start-Process $ps -ArgumentList $argv -PassThru -WindowStyle Hidden
    if (-not $p.WaitForExit(120000)) { taskkill /PID $p.Id /T /F | Out-Null }
    if (Test-Path $qLog) { return (Get-Content -LiteralPath $qLog -Raw) } else { return '' }
  }

  function Run-QueueRows([string] $script, [string] $tag) {
    New-StubTree
    Copy-Item -LiteralPath $Lease -Destination (Join-Path $profileDir 'machine-lease.ps1') -Force
    $holder = New-Holder

    # held lease: the queue must wait / abort and name the owner, and must NOT start the driver
    Reset-QueueState
    Set-Content (Join-Path $profileDir 'meta-fixture.txt') "complete=True" -Encoding ascii
    $null = & $ps -NoProfile -File $Lease take -OwnerPid $holder.Id -Seat forge -Session dev-suite -TtlMinutes 30
    $log = Invoke-Queue $script @('-LeaseWaitMinutes', '0')
    $ran = ($log -match 'run\.9997=started')
    Row "$tag.R8.held_lease_queue_does_not_run" ((-not $ran) -and $log -match 'QA PC busy' -and $log -match 'owner=forge') "ran=$ran log=$log"

    # free lease: the queue runs, holds the lease during the run and releases it on exit
    Reset-QueueState
    Set-Content (Join-Path $profileDir 'meta-fixture.txt') "complete=True" -Encoding ascii
    $log = Invoke-Queue $script @('-LeaseWaitMinutes', '0')
    Row "$tag.R8b.free_lease_queue_runs_and_releases" (($log -match 'run\.9997=started') -and $log -match 'complete\.9997=True' -and -not (Test-Path $leasePath)) "leaseExists=$(Test-Path $leasePath) log=$log"

    # no helper copy: fail closed
    Reset-QueueState
    Set-Content (Join-Path $profileDir 'meta-fixture.txt') "complete=True" -Encoding ascii
    Rename-Item (Join-Path $profileDir 'machine-lease.ps1') 'machine-lease.ps1.off'
    $log = Invoke-Queue $script @('-LeaseWaitMinutes', '0')
    Rename-Item (Join-Path $profileDir 'machine-lease.ps1.off') 'machine-lease.ps1'
    Row "$tag.R8c.missing_helper_refuses" ((-not ($log -match 'run\.9997=started')) -and $log -match 'helper missing') "log=$log"

    # driver verdicts (QA 231): complete=False must never read as bare success
    Reset-QueueState
    Set-Content (Join-Path $profileDir 'meta-fixture.txt') "start=x`r`nrefusal=refusal`r`ncomplete=False" -Encoding ascii
    Set-Content (Join-Path $profileDir 'err-fixture.txt') "Error: You have hit your usage limit" -Encoding ascii
    $log = Invoke-Queue $script @('-LeaseWaitMinutes', '0')
    Row "$tag.R9.complete_false_named" ($log -match 'complete\.9997=False \(refusal=refusal\)') "log=$log"
    Row "$tag.R9b.no_bare_done_marker_true" (($log -match 'done_marker\.9997=') -and -not ($log -match '(?m)done_marker\.9997=True\s*$')) "log=$log"
    Row "$tag.R9c.err_usage_limit_named" ($log -match 'refusal_err\.9997=run-1\.err: .*usage limit') "log=$log"

    Reset-QueueState
    Set-Content (Join-Path $profileDir 'meta-fixture.txt') "start=x" -Encoding ascii
    $log = Invoke-Queue $script @('-LeaseWaitMinutes', '0')
    Row "$tag.R9d.no_complete_line_is_missing" ($log -match 'complete\.9997=missing') "log=$log"
  }

  Run-QueueRows $Queue 'new'
  if ($OldQueue) { Write-Output 'note: rows below run the PRE-T-204 queue; the R8 and R9 rows are expected to be FAIL'; Run-QueueRows $OldQueue 'old' }

  # R10: both scripts parse, and the queue's own self-test still passes
  foreach ($f in $Lease, $Queue) {
    $errs = $null; $null = [System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$null, [ref]$errs)
    Row "R10.parses.$([IO.Path]::GetFileName($f))" (@($errs).Count -eq 0) "$(@($errs).Count) parse errors"
  }
  $st = & $ps -NoProfile -ExecutionPolicy Bypass -File $Queue -Queue 1 -SelfTest 2>&1 | Out-String
  Row 'R10b.queue_selftest' ($st -match 'selftest ok') $st
}
finally {
  foreach ($p in $holders) { try { taskkill /PID $p.Id /T /F 2>$null | Out-Null } catch {} }
  $env:USERPROFILE = $realProfile
}

$failed = @($results | Where-Object { -not $_.ok })
Write-Output "summary passed=$(@($results | Where-Object { $_.ok }).Count) failed=$($failed.Count)"
if ($failed.Count -gt 0) { exit 1 }
