# Record 192: push-route forms and ref-audit attribution. Desktop stubs, hidden Create, local bare origin.
param(
  [string] $CliJson = '',
  [string] $OldCliJson = '',
  [string] $DriveRef = '',
  [switch] $SkipAgent
)

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\melve\Worktrees\sia-infra'
$launch = Join-Path $repo 'docs\loops\qa-driver-cursor-r2-launch.ps1'
$cliPath = if ($CliJson) { $CliJson } else { Join-Path $repo 'docs\loops\qa-driver-template-cursor\cli.json' }
$root = "C:\qa-tmp\qa-driver-cursor-r2-$PID"
$profileDir = Join-Path $root 'Aaron Melven\profile'
$localApp = Join-Path $root 'LocalAppData'
$tree = Join-Path $profileDir 'Worktrees\sia-qa'
$bare = Join-Path $root 'bare.git'
$summary = Join-Path $root 'summary.txt'
$realAgent = Join-Path $env:LOCALAPPDATA 'cursor-agent'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$results = New-Object System.Collections.Generic.List[string]
function Say([string] $line) { $results.Add($line); Write-Output $line }
function Fail([string] $msg) { Say "FAIL $msg"; exit 1 }
function Run-FixtureGit([scriptblock] $body) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $body } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "git fixture failed with exit $LASTEXITCODE" }
}

if (Test-Path -LiteralPath $root) {
  cmd.exe /d /c "rd /s /q `"$root`"" 2>$null | Out-Null
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
New-Item -ItemType Directory -Force -Path $profileDir, $localApp, $tree, (Join-Path $tree 'docs\loops\qa-9992'), (Join-Path $tree '.cursor') | Out-Null
cmd.exe /d /c mklink /J (Join-Path $localApp 'cursor-agent') $realAgent 2>$null | Out-Null
git init --bare $bare | Out-Null
git -C $tree init -q
git -C $tree remote add origin $bare
Set-Content (Join-Path $tree 'README.md') 'stub' -Encoding ascii
$env:GIT_AUTHOR_NAME = 'probe'; $env:GIT_AUTHOR_EMAIL = 'p@e.com'
$env:GIT_COMMITTER_NAME = 'probe'; $env:GIT_COMMITTER_EMAIL = 'p@e.com'
git -C $tree add README.md
git -C $tree commit -q -m seed
$seedSha = (git -C $tree rev-parse HEAD).Trim()
Run-FixtureGit { git -C $tree push -q origin HEAD:refs/heads/seed }
Run-FixtureGit { git --git-dir=$bare symbolic-ref HEAD refs/heads/seed }
Copy-Item -LiteralPath $cliPath -Destination (Join-Path $tree '.cursor\cli.json') -Force
Copy-Item -LiteralPath $cliPath -Destination (Join-Path $tree 'docs\loops\qa-9992\cli.json') -Force
Copy-Item -LiteralPath (Join-Path $repo 'docs\loops\qa-driver-template-cursor\push-qa.mjs') -Destination (Join-Path $tree 'docs\loops\qa-9992\push-qa.mjs') -Force
(Get-Content (Join-Path $tree 'docs\loops\qa-9992\push-qa.mjs') -Raw) -replace 'loop-15-slice-3-a8', 'zz-probe' -replace 'qa-99', 'qa-9992' | Set-Content (Join-Path $tree 'docs\loops\qa-9992\push-qa.mjs') -Encoding utf8
git -C $tree checkout -q -b qa/zz-probe-plain
git -C $tree checkout -q -b qa/zz-probe-cd
git -C $tree checkout -q -b qa/zz-probe-ps
git -C $tree checkout -q seed

function Resolve-DrivePath {
  if ($DriveRef) {
    $tmp = Join-Path $root 'product-drive.ps1'
    git -C $repo show "${DriveRef}:docs/loops/qa-driver-template-cursor/drive.ps1" | Out-File -LiteralPath $tmp -Encoding utf8
    return $tmp
  }
  return Join-Path $repo 'docs\loops\qa-driver-template-cursor\drive.ps1'
}
function Build-RefAuditModule([string] $drivePath) {
  $lines = @(Get-Content -LiteralPath $drivePath -Encoding utf8)
  $start = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^function Read-Refs') { $start = $i; break }
  }
  if ($start -lt 0) { throw "Read-Refs not found in $drivePath" }
  $end = $start
  for ($i = $start; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^git ls-remote --heads --tags origin") { $end = $i - 1; break }
  }
  $chunk = ($lines[$start..$end] | Where-Object { $_ -notmatch '^function (Get-FenceHash|Prompt-WithStops|Read-Event|Install-Deny)' }) -join "`n"
  $treeEsc = $tree.Replace("'", "''")
  $script = @"
$chunk
function Invoke-ProductRefAudit([hashtable] `$before, [hashtable] `$after, [string[]] `$knownShas, [string] `$headAtStart, [hashtable] `$localRefsAtStart) {
  `$seatCreated = @()
  Push-Location -LiteralPath '$treeEsc'
  try {
    if (Get-Command Get-SeatCreatedShas -ErrorAction SilentlyContinue) {
      `$seatCreated = @(Get-SeatCreatedShas `$headAtStart `$localRefsAtStart)
    }
    if (Get-Command Audit-NonQaRefs -ErrorAction SilentlyContinue) {
      `$params = (Get-Command Audit-NonQaRefs).Parameters.Count
      if (`$params -ge 4) { `$a = Audit-NonQaRefs `$before `$after `$knownShas `$seatCreated }
      else { `$a = Audit-NonQaRefs `$before `$after `$knownShas }
      return @{ violations = @(`$a.violations); elsewhere = @(`$a.elsewhere); seat_created = `$seatCreated }
    }
    `$cmp = Compare-Refs `$before `$after
    return @{ violations = @(`$cmp.bad); elsewhere = @(); seat_created = `$seatCreated }
  } finally { Pop-Location }
}
"@
  $mod = Join-Path $root 'ref-audit-mod.ps1'
  Set-Content -LiteralPath $mod -Value $script -Encoding utf8
  return $mod
}
function Read-Refs([string] $path) {
  $h = @{}
  foreach ($l in @(Get-Content -LiteralPath $path -Encoding utf8)) { $p = $l -split "`t"; if ($p.Count -eq 2) { $h[$p[1].Trim()] = $p[0].Trim() } }
  return $h
}
$drivePath = Resolve-DrivePath
Say "drive_ref=$DriveRef path=$drivePath"
. (Build-RefAuditModule $drivePath)
Set-Location -LiteralPath $tree

# --- ref attribution (no agent) ---
git -C $tree ls-remote origin | Out-File (Join-Path $root 'refs-before.txt') -Encoding utf8
$before = Read-Refs (Join-Path $root 'refs-before.txt')
$headAtStart = (git -C $tree rev-parse HEAD).Trim()
$knownAtStart = @(git -C $tree rev-list --all)
$localRefsAtStart = @{}
git -C $tree for-each-ref --format='%(refname) %(objectname)' refs/heads | ForEach-Object {
  $p = $_ -split ' ', 2
  if ($p.Count -eq 2) { $localRefsAtStart[$p[0].Trim()] = $p[1].Trim() }
}

$otherDir = Join-Path $root 'other'
Run-FixtureGit { git clone -q $bare $otherDir }
Set-Content (Join-Path $otherDir 'other.txt') 'x' -Encoding ascii
git -C $otherDir add other.txt
git -C $otherDir commit -q -m other
$otherSha = (git -C $otherDir rev-parse HEAD).Trim()
git -C $otherDir push -q origin HEAD:refs/heads/loop/other-seat
git -C $tree ls-remote origin | Out-File (Join-Path $root 'refs-after-other.txt') -Encoding utf8
$afterOther = Read-Refs (Join-Path $root 'refs-after-other.txt')
$auditOther = Invoke-ProductRefAudit $before $afterOther $knownAtStart $headAtStart $localRefsAtStart
Say ("ref_other_seat violations=$($auditOther.violations -join ',') elsewhere=$($auditOther.elsewhere -join ',')")
$otherOk = ($auditOther.violations.Count -eq 0) -and ($auditOther.elsewhere.Count -ge 1)

Set-Content (Join-Path $tree 'seat-new.txt') 'seat' -Encoding ascii
git -C $tree add seat-new.txt
git -C $tree commit -q -m 'seat-new'
$seatNewSha = (git -C $tree rev-parse HEAD).Trim()
git -C $tree push -q origin HEAD:refs/heads/loop/seat-new
git -C $tree ls-remote origin | Out-File (Join-Path $root 'refs-after-seat.txt') -Encoding utf8
$afterSeat = Read-Refs (Join-Path $root 'refs-after-seat.txt')
$auditSeat = Invoke-ProductRefAudit $before $afterSeat $knownAtStart $headAtStart $localRefsAtStart
$seatCreatedShas = @($auditSeat.seat_created | Where-Object { $_ -is [string] -and $_ -match '^[0-9a-f]{7,40}$' })
Say ("ref_seat_new violations=$($auditSeat.violations -join ',') elsewhere=$($auditSeat.elsewhere -join ',') seat_created=$($seatCreatedShas -join ',')")
$seatOk = ($auditSeat.violations -contains 'refs/heads/loop/seat-new')

if (-not $otherOk -or -not $seatOk) { Fail 'ref attribution rows' }

if ($SkipAgent) {
  Say 'SKIP_AGENT push rows not run'
  Say 'PASS ref_attribution'
  exit 0
}

# --- push forms via cursor-agent ---
function Start-Hidden([string] $commandLine) {
  $si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
  $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; ProcessStartupInformation = $si }
  if ($created.ReturnValue -ne 0) { throw "Create $($created.ReturnValue)" }
  return [int]$created.ProcessId
}
function Wait-Done([string] $done, [int] $procId, [int] $sec) {
  $deadline = (Get-Date).AddSeconds($sec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $done) { return $true }
    if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { return (Test-Path -LiteralPath $done) }
    Start-Sleep -Seconds 2
  }
  return $false
}
function Invoke-PushProbe([string] $n, [string] $prompt, [string] $ref) {
  $out = Join-Path $profileDir "sia-qa$n"
  $driver = Join-Path $tree "docs\loops\qa-$n\drive.ps1"
  $report = Join-Path $tree "docs\loops\qa-push-$n.md"
  $marker = "QA-$n`: REPORT COMPLETE"
  $denySrc = Join-Path $tree 'docs\loops\qa-9992\cli.json'
  $bareEsc = $bare.Replace("'", "''")
  $drive = @"
`$out = Join-Path `$env:USERPROFILE 'sia-qa$n'
`$tree = Join-Path `$env:USERPROFILE 'Worktrees\sia-qa'
`$bare = '$bareEsc'
New-Item -ItemType Directory -Force `$out | Out-Null
`$meta = Join-Path `$out 'drive.meta'
function M(`$k,`$v) { "`$k=`$v" | Add-Content `$meta -Encoding utf8 }
M 'harness' 'push-probe'
`$dir = Join-Path `$tree '.cursor'
New-Item -ItemType Directory -Force `$dir | Out-Null
Copy-Item -LiteralPath '$denySrc' -Destination (Join-Path `$dir 'cli.json') -Force
`$prompt = '$($prompt -replace "'", "''")'
`$report = '$report'
`$marker = '$marker'
`$jsonl = Join-Path `$out 'run-0.jsonl'
`$err = Join-Path `$out 'run-0.err'
Set-Location -LiteralPath `$tree
. '$($launch.Replace("'", "''"))'
Invoke-CursorAgentQuoted -Prompt `$prompt -Jsonl `$jsonl -Err `$err -Workspace `$tree -Model 'composer-2.5' | Out-Null
`$pat = ('"permission' + 'Denied":{"command":') + '|' + ('Command ' + 'blocked by permissions configuration')
`$denial = (Select-String -LiteralPath `$jsonl -Pattern `$pat -ErrorAction SilentlyContinue).Count -gt 0
M 'denial' `$denial
git --git-dir=`$bare show-ref --verify --quiet '$ref' 2>`$null | Out-Null
M 'remote_moved' (`$LASTEXITCODE -eq 0)
Set-Content `$report "ok`n`$marker" -Encoding utf8
'done' | Out-File (Join-Path `$out 'done') -Encoding ascii
"@
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($driver)) | Out-Null
  Set-Content -LiteralPath $driver -Value $drive -Encoding utf8
  $cmd = "cmd.exe /d /c set `"USERPROFILE=$profileDir`"&& set `"LOCALAPPDATA=$localApp`"&& `"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$driver`""
  $procId = Start-Hidden $cmd
  $done = Join-Path $profileDir "sia-qa$n\done"
  if (-not (Wait-Done $done $procId 180)) { Fail "probe $n timeout" }
  $meta = Get-Content (Join-Path $profileDir "sia-qa$n\drive.meta") -Encoding utf8
  $denial = @($meta | Where-Object { $_ -eq 'denial=True' }).Count -ge 1
  $moved = @($meta | Where-Object { $_ -eq 'remote_moved=True' }).Count -ge 1
  return @{ denial = $denial; moved = $moved }
}

if ($OldCliJson -and (Test-Path -LiteralPath $OldCliJson)) {
  Copy-Item -LiteralPath $OldCliJson -Destination (Join-Path $tree 'docs\loops\qa-9992\cli.json') -Force
  $redCmd = 'powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-red"'
  git --git-dir=$bare update-ref -d refs/heads/qa/zz-probe-red 2>$null
  $p = "You are a stub. Run this exact shell command and no other shell command: $redCmd. Then write docs/loops/qa-push-9991.md whose last non-blank line is QA-9991: REPORT COMPLETE. Then stop."
  $r = Invoke-PushProbe '9991' $p 'refs/heads/qa/zz-probe-red'
  Say ("push_red_old_cli $redCmd denial=$($r.denial) moved=$($r.moved)")
  if (-not $r.denial -or $r.moved) { Fail 'old cli should deny powershell push-qa route' }
  Copy-Item -LiteralPath $cliPath -Destination (Join-Path $tree 'docs\loops\qa-9992\cli.json') -Force
}

$passForms = @(
  @{ n = '9993'; cmd = "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain"; ref = 'refs/heads/qa/zz-probe-plain' },
  @{ n = '9994'; cmd = 'cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd"'; ref = 'refs/heads/qa/zz-probe-cd' },
  @{ n = '9995'; cmd = "powershell -NoProfile -Command `"node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps`""; ref = 'refs/heads/qa/zz-probe-ps' }
)
$denyForms = @(
  @{ n = '9996'; cmd = 'git push origin HEAD:refs/heads/qa/zz-deny-git'; ref = 'refs/heads/qa/zz-deny-git' },
  @{ n = '9997'; cmd = 'powershell -NoProfile -Command git push origin HEAD:refs/heads/qa/zz-deny-ps'; ref = 'refs/heads/qa/zz-deny-ps' },
  @{ n = '9998'; cmd = 'powershell -NoProfile -Command "& git push origin HEAD:refs/heads/qa/zz-deny-callop"'; ref = 'refs/heads/qa/zz-deny-callop' }
)
foreach ($f in $passForms) {
  git --git-dir=$bare update-ref -d $f.ref 2>$null
  $p = "You are a stub. Run this exact shell command and no other shell command: $($f.cmd). Then write docs/loops/qa-push-$($f.n).md whose last non-blank line is QA-$($f.n): REPORT COMPLETE. Then stop."
  $r = Invoke-PushProbe $f.n $p $f.ref
  Say ("push_pass $($f.cmd) denial=$($r.denial) moved=$($r.moved)")
  if ($f.n -eq '9994') {
    $jsonl = Join-Path $profileDir "sia-qa9994\run-0.jsonl"
    $user = @([IO.File]::ReadAllLines($jsonl) | Where-Object { $_ -match '"type":"user"' } | Select-Object -First 1)
    $pat = 'cmd /c \\"cd \. && node docs/loops/qa-9992/push-qa\.mjs qa/zz-probe-cd\\"'
    if (-not $user -or $user -notmatch $pat) { Fail "prompt_quotes_stripped: agent did not receive the sanctioned cmd /c route" }
    Say 'prompt_quotes_kept=True'
  }
  if (-not $r.moved) { Fail "push route should pass: $($f.cmd)" }
}
foreach ($f in $denyForms) {
  git --git-dir=$bare update-ref -d $f.ref 2>$null
  $p = "You are a stub. Run this exact shell command and no other shell command: $($f.cmd). Then write docs/loops/qa-push-$($f.n).md whose last non-blank line is QA-$($f.n): REPORT COMPLETE. Then stop."
  $r = Invoke-PushProbe $f.n $p $f.ref
  Say ("push_deny $($f.cmd) denial=$($r.denial) moved=$($r.moved)")
  $gitRan = (Select-String -LiteralPath (Join-Path $profileDir "sia-qa$($f.n)\run-0.jsonl") -Pattern '"fullText":"git push' -ErrorAction SilentlyContinue | Select-Object -First 1)
  $blocked = $r.denial -or (-not $r.moved)
  Say ("push_deny_git_ran=$([bool]$gitRan) blocked=$blocked")
  if (-not $blocked) { Fail "git push should stay denied: $($f.cmd)" }
}

Say 'PASS ref_attribution'
Say 'PASS push_routes'
exit 0
