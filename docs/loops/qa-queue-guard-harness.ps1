# Proves the queue lock the way a queue is actually launched: Invoke-CimMethod Win32_Process Create,
# a stub driver (docs/loops/qa-9997/drive.ps1, sleep only, never claude), and a profile path with a space.
# The stub tree is under $env:TEMP. This harness refuses to touch %USERPROFILE%\Worktrees\sia-qa or
# %USERPROFILE%\qa-queue.ps1.
#
# The child CommandLine is the desktop form in qa-launch.md (full powershell.exe path, -File, CurrentDirectory)
# prefixed with `cmd /c set USERPROFILE=<temp>\Aaron Melven` so the test profile is not the real one.
# WMI Create does not take an environment block; the probe on 2026-09-27 showed a parent env var is not
# inherited, and `cmd /c set` is.
param(
  [Parameter(Mandatory = $true)] [string] $NewScript,
  [string] $OldScript = '',
  [switch] $RestoreOnly
)

$ErrorActionPreference = 'Stop'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$tempRoot = Join-Path $env:TEMP 'qa-queue-guard-harness'
$realTree = [System.IO.Path]::GetFullPath((Join-Path $env:USERPROFILE 'Worktrees\sia-qa'))
$realScript = [System.IO.Path]::GetFullPath((Join-Path $env:USERPROFILE 'qa-queue.ps1'))

function Fail([string] $msg) { Write-Output "FAIL $msg"; exit 1 }

if (-not (Test-Path -LiteralPath $NewScript)) { Fail "new script missing: $NewScript" }
$newFull = [System.IO.Path]::GetFullPath($NewScript)
if ($newFull -eq $realScript) { Fail 'refusing to launch the real user-folder qa-queue.ps1' }

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.CommandLine -like '*qa-queue-guard-harness*drive.ps1*' -or $_.CommandLine -like '*qa-queue-guard-harness*qa-queue.ps1*') {
    taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null
  }
}
if (Test-Path $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
New-Item -ItemType Directory -Force $tempRoot | Out-Null

$results = New-Object System.Collections.Generic.List[string]
$script:Expectations = New-Object System.Collections.Generic.List[object]
function Note([string] $line) { $results.Add($line); Write-Output $line }

function Register-Expect([string] $line, [string] $role) {
  # role new: every _expect must be True. role old: every _expect is the red (must be False).
  if ($line -notmatch '_expect (.+)=(True|False)$') { return }
  $actual = ($Matches[2] -eq 'True')
  $passed = if ($role -eq 'old') { -not $actual } else { $actual }
  $script:Expectations.Add([pscustomobject]@{ line = $line; role = $role; passed = $passed })
}

function Finish-RestoreExpectations {
  $failed = @($script:Expectations | Where-Object { -not $_.passed })
  $passed = @($script:Expectations | Where-Object { $_.passed })
  Note ("expect_summary role=new|old passed=$($passed.Count) failed=$($failed.Count)")
  foreach ($f in $failed) { Note ("FAIL_EXPECT $($f.line) role=$($f.role)") }
  if ($failed.Count -gt 0) { exit 1 }
}

function New-StubRepo([string] $userProfile) {
  $tree = Join-Path $userProfile 'Worktrees\sia-qa'
  $full = [System.IO.Path]::GetFullPath($tree)
  if ($full -eq $realTree) { Fail "stub tree resolved to the real QA tree: $full" }
  if ($full -notlike "$tempRoot*") { Fail "stub tree is outside the temp root: $full" }
  if ($userProfile -notlike '* *') { Fail "profile path has no space: $userProfile" }
  New-Item -ItemType Directory -Force (Join-Path $tree 'docs\loops\qa-9997') | Out-Null
  $driver = @'
$dest = Join-Path $env:USERPROFILE "sia-qa9997"
New-Item -ItemType Directory -Force $dest | Out-Null
Set-Content (Join-Path $dest "alive") $PID
$gen = Join-Path $env:USERPROFILE "Worktrees\sia-qa\generation.txt"
Set-Content (Join-Path $dest "gen-start") (Get-Content $gen -Raw)
Start-Sleep -Seconds 50
Set-Content (Join-Path $dest "gen-end") (Get-Content $gen -Raw)
Set-Content (Join-Path $dest "done") "1"
'@
  Set-Content -LiteralPath (Join-Path $tree 'docs\loops\qa-9997\drive.ps1') -Value $driver -Encoding ascii
  Set-Content -LiteralPath (Join-Path $tree 'generation.txt') -Value "A`n" -Encoding ascii
  $git = {
    param([string[]] $gitArgs)
    & git -C $tree -c user.email=qa-queue-guard@example.com -c user.name=qa-queue-guard -c commit.gpgsign=false @gitArgs
    if ($LASTEXITCODE -ne 0) { Fail "git $($gitArgs -join ' ') failed in $tree" }
  }
  & $git @('init', '-q')
  & $git @('add', 'generation.txt', 'docs/loops/qa-9997/drive.ps1')
  & $git @('commit', '-q', '-m', 'A')
  $shaA = (& git -C $tree rev-parse HEAD).Trim()
  Set-Content -LiteralPath (Join-Path $tree 'generation.txt') -Value "B`n" -Encoding ascii
  & $git @('add', 'generation.txt')
  & $git @('commit', '-q', '-m', 'B')
  $shaB = (& git -C $tree rev-parse HEAD).Trim()
  $bare = Join-Path $userProfile 'origin.git'
  & git init -q --bare $bare
  if ($LASTEXITCODE -ne 0) { Fail 'bare origin init failed' }
  & git -C $tree remote add origin $bare
  & git -C $tree push -q origin HEAD:refs/heads/master
  if ($LASTEXITCODE -ne 0) { Fail 'push to local origin failed' }
  return @{ tree = $tree; shaA = $shaA; shaB = $shaB; user = $userProfile }
}

function Start-DetachedQueue([string] $scriptPath, [string] $userProfile, [string] $sha, [string] $queueItems = '9997') {
  $fullScript = [System.IO.Path]::GetFullPath($scriptPath)
  $fullUser = [System.IO.Path]::GetFullPath($userProfile)
  if ($fullScript -eq $realScript) { Fail 'refusing to launch the real qa-queue.ps1' }
  if ($fullUser -notlike "$tempRoot*") { Fail "USERPROFILE outside temp: $fullUser" }
  # ShowWindow 0 hides the Create. -WindowStyle Hidden is on the powershell cmd starts, so that
  # child does not open a console of its own. A non-zero MainWindowHandle is a visible window.
  $cmd = "cmd.exe /d /c set `"USERPROFILE=$fullUser`"&& set `"GIT_TERMINAL_PROMPT=0`"&& `"$ps`" -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$fullScript`" -Queue $queueItems -Checkout $sha -QuietCpuPercent 101 -TimeoutMinutes 2 -StartWaitMinutes 2"
  $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
  $created = Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{
    CommandLine = $cmd
    CurrentDirectory = $fullUser
    ProcessStartupInformation = $startup
  }
  if ($created.ReturnValue -ne 0) { Fail "Win32_Process Create ReturnValue=$($created.ReturnValue)" }
  Start-Sleep -Milliseconds 500
  $visible = @()
  $ids = @([int]$created.ProcessId)
  $kids = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($created.ProcessId)" -ErrorAction SilentlyContinue)
  foreach ($k in $kids) { if ($k.ProcessId) { $ids += [int]$k.ProcessId } }
  foreach ($id in $ids) {
    $gp = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($gp -and $gp.MainWindowHandle -ne 0) { $visible += $id }
  }
  if ($visible.Count -gt 0) {
    Stop-Pid ([int]$created.ProcessId)
    Fail "Create opened a window (pids $($visible -join ','))"
  }
  return @{ pid = [int]$created.ProcessId; cmd = $cmd }
}

function Stop-Pid([int] $procId) {
  if (-not $procId) { return }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & taskkill.exe /PID $procId /T /F 1>$null 2>$null
  $ErrorActionPreference = $prev
}

function Read-Lines([string] $path, [int] $maxWaitMs = 2000) {
  if (-not (Test-Path -LiteralPath $path)) { return @() }
  $deadline = (Get-Date).AddMilliseconds($maxWaitMs)
  while ($true) {
    try {
      $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
      try {
        $sr = New-Object System.IO.StreamReader($fs)
        $text = $sr.ReadToEnd()
        $sr.Dispose()
        return @($text -split '\r?\n' | Where-Object { $_ -ne '' })
      } finally {
        $fs.Dispose()
      }
    } catch {
      if ((Get-Date) -ge $deadline) { Fail "read_failed path=$path error=$($_.Exception.Message)" }
      Start-Sleep -Milliseconds 200
    }
  }
}

function Wait-File([string] $path, [int] $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $path) { return $true }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

function Wait-LogCount([string] $path, [int] $atLeast, [int] $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if ((Read-Lines $path).Count -ge $atLeast) { return $true }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

function New-TwoItemRestoreRepo([string] $userProfile, [switch] $LockGeneration) {
  $tree = Join-Path $userProfile 'Worktrees\sia-qa'
  $full = [System.IO.Path]::GetFullPath($tree)
  if ($full -eq $realTree) { Fail "stub tree resolved to the real QA tree: $full" }
  if ($full -notlike "$tempRoot*") { Fail "stub tree is outside the temp root: $full" }
  if ($userProfile -notlike '* *') { Fail "profile path has no space: $userProfile" }
  New-Item -ItemType Directory -Force (Join-Path $tree 'docs\loops\qa-9996') | Out-Null
  New-Item -ItemType Directory -Force (Join-Path $tree 'docs\loops\qa-9997') | Out-Null
  $lockBlock = ''
  if ($LockGeneration) {
    $lockBlock = @'

$indexLock = Join-Path $env:USERPROFILE "Worktrees\sia-qa\.git\index.lock"
Set-Content -LiteralPath $indexLock -Value "harness lock" -Encoding ascii
'@
  }
  $driver9996 = @"
`$dest = Join-Path `$env:USERPROFILE "sia-qa9996"
New-Item -ItemType Directory -Force `$dest | Out-Null
Set-Content (Join-Path `$dest "alive") `$PID
Set-Location (Join-Path `$env:USERPROFILE "Worktrees\sia-qa")
`$shaB = (Get-Content ".shaB" -Raw).Trim()
git checkout -q --detach `$shaB
New-Item -ItemType Directory -Force "docs\loops\qa-9997" | Out-Null
Set-Content "docs\loops\qa-9997\drive.ps1" "# untracked blocker" -Encoding ascii
$lockBlock
Set-Content (Join-Path `$dest "done") "1"
"@
  $driver9997 = @'
$dest = Join-Path $env:USERPROFILE "sia-qa9997"
New-Item -ItemType Directory -Force $dest | Out-Null
Set-Content (Join-Path $dest "item2-ran") "1"
Set-Content (Join-Path $dest "done") "1"
'@
  Set-Content -LiteralPath (Join-Path $tree 'docs\loops\qa-9996\drive.ps1') -Value $driver9996 -Encoding ascii
  Set-Content -LiteralPath (Join-Path $tree 'docs\loops\qa-9997\drive.ps1') -Value $driver9997 -Encoding ascii
  Set-Content -LiteralPath (Join-Path $tree 'generation.txt') -Value "A`n" -Encoding ascii
  $git = {
    param([string[]] $gitArgs)
    & git -C $tree -c user.email=qa-queue-guard@example.com -c user.name=qa-queue-guard -c commit.gpgsign=false @gitArgs
    if ($LASTEXITCODE -ne 0) { Fail "git $($gitArgs -join ' ') failed in $tree" }
  }
  & $git @('init', '-q')
  & $git @('add', 'generation.txt', 'docs/loops/qa-9996/drive.ps1', 'docs/loops/qa-9997/drive.ps1')
  & $git @('commit', '-q', '-m', 'A')
  $shaA = (& git -C $tree rev-parse HEAD).Trim()
  Set-Content -LiteralPath (Join-Path $tree 'generation.txt') -Value "B`n" -Encoding ascii
  Remove-Item -LiteralPath (Join-Path $tree 'docs\loops\qa-9997\drive.ps1') -Force
  & $git @('add', 'generation.txt')
  & $git @('add', '-u')
  & $git @('commit', '-q', '-m', 'B')
  $shaB = (& git -C $tree rev-parse HEAD).Trim()
  Set-Content -LiteralPath (Join-Path $tree '.shaB') -Value "$shaB`n" -Encoding ascii
  & $git @('checkout', '-q', '--detach', $shaA)
  return @{ tree = $tree; shaA = $shaA; shaB = $shaB; user = $userProfile }
}

function Run-RestoreHarness([string] $scriptPath, [string] $label) {
  $restoreUser = Join-Path $tempRoot "restore-$label\Aaron Melven"
  if (Test-Path (Split-Path $restoreUser -Parent)) { Remove-Item -LiteralPath (Split-Path $restoreUser -Parent) -Recurse -Force }
  $untracked = New-TwoItemRestoreRepo $restoreUser
  $lockUser = Join-Path $tempRoot "restore-lock-$label\Aaron Melven"
  if (Test-Path (Split-Path $lockUser -Parent)) { Remove-Item -LiteralPath (Split-Path $lockUser -Parent) -Recurse -Force }
  $locked = New-TwoItemRestoreRepo $lockUser -LockGeneration

  foreach ($case in @(
    @{ name = 'untracked_block'; repo = $untracked; user = $restoreUser; expectItem2 = $true }
    @{ name = 'locked_generation'; repo = $locked; user = $lockUser; expectItem2 = $false }
  )) {
    $logDir = Join-Path $case.user 'sia-qa-queue'
    if (Test-Path $logDir) { Remove-Item -LiteralPath $logDir -Recurse -Force }
    $launch = Start-DetachedQueue $scriptPath $case.user $case.repo.shaA '9996,9997'
    $log = Join-Path $logDir 'queue.log'
    $deadline = (Get-Date).AddSeconds(120)
    $done = $false
    while ((Get-Date) -lt $deadline) {
      $lines = Read-Lines $log
      if (@($lines | Where-Object { $_ -match ' end=' }).Count -ge 1) { $done = $true; break }
      if (@($lines | Where-Object { $_ -match ' abort=' }).Count -ge 1) { $done = $true; break }
      Start-Sleep -Milliseconds 500
    }
    Start-Sleep -Seconds 2
    $lines = Read-Lines $log
    $headEnd = (& git -C $case.repo.tree rev-parse HEAD).Trim()
    $item2Ran = Test-Path (Join-Path $case.user 'sia-qa9997\item2-ran')
    $restoreFailed = @($lines | Where-Object { $_ -match ' restore_failed\.9997=' })
    $run9997 = @($lines | Where-Object { $_ -match ' run\.9997=' })
    $exit9997 = @($lines | Where-Object { $_ -match ' exit\.9997=' })
    Stop-Pid $launch.pid
    $exitText = ($exit9997 -join '; ')
    Note ("restore_${label}_$($case.name) done=$done head=$headEnd shaA=$($case.repo.shaA) item2_ran=$item2Ran restore_failed=$($restoreFailed.Count) run9997=$($run9997.Count) exit9997=$exitText")
    if ($case.expectItem2) {
      $expectLine = "restore_${label}_$($case.name)_expect item2_on_shaA=$($item2Ran -and $headEnd -eq $case.repo.shaA)"
      Note $expectLine
      Register-Expect $expectLine $label
    } else {
      $expectLine = "restore_${label}_$($case.name)_expect no_run_and_failed=$($restoreFailed.Count -ge 1 -and $run9997.Count -eq 0)"
      Note $expectLine
      Register-Expect $expectLine $label
    }
  }
}

if ($RestoreOnly) {
  Note '--- restore scenarios only ---'
  Run-RestoreHarness $NewScript 'new'
  if ($OldScript -and (Test-Path -LiteralPath $OldScript)) {
    Run-RestoreHarness $OldScript 'old'
  }
  Finish-RestoreExpectations
  exit 0
}

# --- live holder is not taken over ---
$liveUser = Join-Path $tempRoot 'live\Aaron Melven'
$live = New-StubRepo $liveUser
$stamp = (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o')
$lockDir = Join-Path $liveUser 'sia-qa-queue'
New-Item -ItemType Directory -Force $lockDir | Out-Null
$lockPath = Join-Path $lockDir 'queue.lock'
[System.IO.File]::WriteAllText($lockPath, "pid=$PID`r`nstart=$stamp`r`n")
$headBefore = (& git -C $live.tree rev-parse HEAD).Trim()
$liveLaunch = Start-DetachedQueue $NewScript $liveUser $live.shaA
$log = Join-Path $lockDir 'queue.log'
$sawRefuse = Wait-LogCount $log 1 20
Start-Sleep -Seconds 2
$headAfter = (& git -C $live.tree rev-parse HEAD).Trim()
$gen = (Get-Content (Join-Path $live.tree 'generation.txt') -Raw).Trim()
$lockAfter = [System.IO.File]::ReadAllText($lockPath)
$refuseLine = @(Read-Lines $log | Where-Object { $_ -match ' refuse=' })
Stop-Pid $liveLaunch.pid
$liveOk = $sawRefuse -and ($headAfter -eq $headBefore) -and ($gen -eq 'B') -and ($lockAfter -match "pid=$PID") -and ($refuseLine.Count -ge 1) -and (@(Read-Lines $log | Where-Object { $_ -match ' head=' }).Count -eq 0)
Note ("live_holder_refused=$liveOk head_same=$($headAfter -eq $headBefore) gen=$gen refuse=$($refuseLine -join ' | ')")

# --- a live pid whose start time differs is a stale lock and is taken over ---
$stampWrong = '1999-01-01T00:00:00.0000000Z'
[System.IO.File]::WriteAllText($lockPath, "pid=$PID`r`nstart=$stampWrong`r`n")
$changed = Start-DetachedQueue $NewScript $liveUser $live.shaA
$sawTakeover = $false
$takeoverLine = ''
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
  $hit = @(Read-Lines $log | Where-Object { $_ -match ' takeover=.*reason=start_changed' })
  if ($hit.Count -ge 1) { $sawTakeover = $true; $takeoverLine = $hit[-1]; break }
  Start-Sleep -Milliseconds 300
}
Stop-Pid $changed.pid
Note ("start_changed_taken_over=$sawTakeover line=$takeoverLine")
if (-not $sawTakeover) { Fail 'a live pid with a different start time was not taken over' }

# --- stale pid is taken over; a second Create'd queue refuses; the tree does not move ---
$newUser = Join-Path $tempRoot 'new\Aaron Melven'
$neu = New-StubRepo $newUser
$newLockDir = Join-Path $newUser 'sia-qa-queue'
New-Item -ItemType Directory -Force $newLockDir | Out-Null
$newLock = Join-Path $newLockDir 'queue.lock'
$stalePid = 2147483646
$staleProbe = Get-Process -Id $stalePid -ErrorAction SilentlyContinue
if ($staleProbe) { Fail "pid $stalePid exists; pick another stale pid" }
[System.IO.File]::WriteAllText($newLock, "pid=$stalePid`r`nstart=2000-01-01T00:00:00.0000000Z`r`n")
$first = Start-DetachedQueue $NewScript $newUser $neu.shaA
$alive = Join-Path $newUser 'sia-qa9997\alive'
$driverUp = Wait-File $alive 90
$newLog = Join-Path $newLockDir 'queue.log'
$linesAfterFirst = Read-Lines $newLog
$takeover = @($linesAfterFirst | Where-Object { $_ -match ' takeover=' })
$headAtDriver = ''
if ($driverUp) { $headAtDriver = (& git -C $neu.tree rev-parse HEAD).Trim() }
$driverPid = 0
if ($driverUp) { $driverPid = [int](Get-Content $alive -Raw).Trim() }
$driverProc = $null
if ($driverPid) { $driverProc = Get-CimInstance Win32_Process -Filter "ProcessId=$driverPid" -ErrorAction SilentlyContinue }
$driverCl = [string]$driverProc.CommandLine
Note ("first_driver_up=$driverUp takeover=$($takeover.Count -ge 1) head=$headAtDriver shaA=$($neu.shaA) driver_pid=$driverPid commandline_null=$([string]::IsNullOrEmpty($driverCl))")

$second = $null
$overlapOk = $false
if ($driverUp -and $headAtDriver -eq $neu.shaA) {
  $countBefore = (Read-Lines $newLog).Count
  $second = Start-DetachedQueue $NewScript $newUser $neu.shaB
  $deadline = (Get-Date).AddSeconds(25)
  $newLines = @()
  do {
    Start-Sleep -Milliseconds 400
    $all = Read-Lines $newLog
    if ($all.Count -gt $countBefore) { $newLines = @($all | Select-Object -Skip $countBefore) }
  } while (($newLines | Where-Object { $_ -match ' refuse=' }).Count -lt 1 -and (Get-Date) -lt $deadline)
  Start-Sleep -Seconds 2
  $headNow = (& git -C $neu.tree rev-parse HEAD).Trim()
  $genNow = (Get-Content (Join-Path $neu.tree 'generation.txt') -Raw).Trim()
  $driverStill = $null -ne (Get-Process -Id $driverPid -ErrorAction SilentlyContinue)
  $refused = @($newLines | Where-Object { $_ -match ' refuse=' })
  $moved = @($newLines | Where-Object { $_ -match ' head=' -or $_ -match ' takeover=' })
  $overlapOk = ($refused.Count -ge 1) -and ($moved.Count -eq 0) -and ($headNow -eq $neu.shaA) -and ($genNow -eq 'A') -and $driverStill
  Note ("second_refused=$overlapOk driver_still=$driverStill head=$headNow gen=$genNow new_lines=$($newLines -join ' || ')")
} else {
  Note 'second_refused=False first queue never reached the stub driver'
}
if ($second) { Stop-Pid $second.pid }
Stop-Pid $first.pid
if ($driverPid) { Stop-Pid $driverPid }

# --- known positive: the pre-lock script, same launch, moves the tree under the stub if it cannot see the driver ---
$oldOk = $false
$oldRan = $false
if ($OldScript -and (Test-Path -LiteralPath $OldScript)) {
  $oldRan = $true
  $oldUser = Join-Path $tempRoot 'old\Aaron Melven'
  $old = New-StubRepo $oldUser
  $oldFirst = Start-DetachedQueue $OldScript $oldUser $old.shaA
  $oldAlive = Join-Path $oldUser 'sia-qa9997\alive'
  $oldUp = Wait-File $oldAlive 90
  $oldDriver = 0
  if ($oldUp) { $oldDriver = [int](Get-Content $oldAlive -Raw).Trim() }
  $oldLog = Join-Path $oldUser 'sia-qa-queue\queue.log'
  $oldHead = ''
  if ($oldUp) { $oldHead = (& git -C $old.tree rev-parse HEAD).Trim() }
  $reproduced = $false
  $oldSecond = $null
  if ($oldUp -and $oldHead -eq $old.shaA) {
    $before = (Read-Lines $oldLog).Count
    $oldSecond = Start-DetachedQueue $OldScript $oldUser $old.shaB
    $deadline = (Get-Date).AddSeconds(20)
    do {
      Start-Sleep -Milliseconds 500
      $nowHead = (& git -C $old.tree rev-parse HEAD).Trim()
      $still = $null -ne (Get-Process -Id $oldDriver -ErrorAction SilentlyContinue)
      if ($nowHead -eq $old.shaB -and $still) { $reproduced = $true; break }
      if (-not $still) { break }
    } while ((Get-Date) -lt $deadline)
    $finalHead = (& git -C $old.tree rev-parse HEAD).Trim()
    $stillEnd = $null -ne (Get-Process -Id $oldDriver -ErrorAction SilentlyContinue)
    $added = @(Read-Lines $oldLog | Select-Object -Skip $before)
    $cl = ''
    $seen = Get-CimInstance Win32_Process -Filter "ProcessId=$oldDriver" -ErrorAction SilentlyContinue
    if ($seen) { $cl = [string]$seen.CommandLine }
    Note ("old_moved_under_driver=$reproduced final_head_is_B=$($finalHead -eq $old.shaB) driver_alive_at_end=$stillEnd commandline_null=$([string]::IsNullOrEmpty($cl)) added=$($added -join ' || ')")
    $oldOk = $reproduced
  } else {
    Note "old_moved_under_driver=False driver_up=$oldUp head=$oldHead"
  }
  if ($oldSecond) { Stop-Pid $oldSecond.pid }
  Stop-Pid $oldFirst.pid
  if ($oldDriver) { Stop-Pid $oldDriver }
}

Note '--- restore scenarios ---'
Run-RestoreHarness $NewScript 'new'
if ($OldScript -and (Test-Path -LiteralPath $OldScript)) {
  Run-RestoreHarness $OldScript 'old'
}
Finish-RestoreExpectations

Note '--- summary ---'
Note ("PASS live_holder_refused=$liveOk")
Note ("PASS stale_takeover_and_second_refuses=$overlapOk")
if ($oldRan) { Note ("KNOWN_POSITIVE old_script_moved_under_live_driver=$oldOk") }
$bad = (-not $liveOk) -or (-not $overlapOk)
if ($bad) { exit 1 }
exit 0
