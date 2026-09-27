# Proves the Cursor QA driver on this desktop, hidden, with stub prompts.
# A profile path containing a space (Aaron Melven) is the USERPROFILE and the LOCALAPPDATA the driver sees.
# The remote is a local bare repo, never the real origin.
param([switch] $QueueOnly)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path -LiteralPath (Join-Path $repo 'docs\loops\qa-driver-copy.mjs'))) {
  $repo = 'C:\Users\melve\Worktrees\sia-infra'
}
$root = 'C:\qa-tmp\cqa\Aaron Melven'
$profileDir = Join-Path $root 'profile'
$localApp = Join-Path $root 'LocalAppData'
$tree = Join-Path $profileDir 'Worktrees\sia-qa'
$bare = Join-Path $root 'bare.git'
$summary = Join-Path $root 'summary.txt'
$realAgent = Join-Path $env:LOCALAPPDATA 'cursor-agent'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Say([string] $line) { $line | Tee-Object -FilePath $summary -Append | Out-Host }

if (Test-Path -LiteralPath $root) { cmd.exe /d /c "rmdir /s /q \\?\$root" | Out-Null }
New-Item -ItemType Directory -Force -Path $profileDir, $localApp, (Join-Path $tree 'docs\loops') | Out-Null
Set-Content -LiteralPath $summary -Value 'start' -Encoding ascii

$junction = Join-Path $localApp 'cursor-agent'
cmd.exe /d /c mklink /J "$junction" "$realAgent" | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $junction 'cursor-agent.ps1'))) { throw 'junction to cursor-agent failed' }
Say "junction=$junction"

New-Item -ItemType Directory -Force -Path $bare | Out-Null
git init --bare $bare | Out-Null
git -C $tree init -q
git -C $tree remote add origin $bare
Set-Content -LiteralPath (Join-Path $tree 'README.md') -Value 'stub' -Encoding ascii
git -C $tree add README.md
$env:GIT_AUTHOR_NAME = 'probe'
$env:GIT_AUTHOR_EMAIL = 'probe@example.com'
$env:GIT_COMMITTER_NAME = 'probe'
$env:GIT_COMMITTER_EMAIL = 'probe@example.com'
git -C $tree commit -q -m stub
git -C $tree push -q origin HEAD:refs/heads/seed

function Copy-Tree([string] $from, [string] $to) {
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  Copy-Item -Path (Join-Path $from '*') -Destination $to -Recurse -Force
}
Copy-Tree (Join-Path $repo 'docs\loops\qa-driver-template-cursor') (Join-Path $tree 'docs\loops\qa-driver-template-cursor')
Copy-Item -LiteralPath (Join-Path $repo 'docs\loops\qa-driver-copy.mjs') -Destination (Join-Path $tree 'docs\loops\qa-driver-copy.mjs') -Force
Copy-Item -LiteralPath (Join-Path $repo 'docs\loops\qa-queue.ps1') -Destination (Join-Path $tree 'docs\loops\qa-queue.ps1') -Force

function Invoke-Copy([string] $n, [string] $report, [string] $prefix, [string] $prompt) {
  $out = node (Join-Path $tree 'docs\loops\qa-driver-copy.mjs') --harness cursor --model composer-2.5-fast $n $report "docs/loops/unused.md" $prefix $prompt
  if ($LASTEXITCODE -ne 0) { throw "copier $n failed: $out" }
  Say "copied=$n $out"
}
Set-Location -LiteralPath $tree
$pushPrompt = 'You are a stub. Run this exact shell command and no other shell command: git push origin HEAD:refs/heads/qa/zz-probe-1. Do not edit files under .cursor. After the command finishes or is denied, write docs/loops/qa-driver-cursor-probe-report.md so its last non-blank line is exactly the marker in the standing instruction below. Then stop.'
$positivePrompt = 'You are a stub. Run this exact shell command and no other shell command: git push origin HEAD:refs/heads/qa/zz-probe-1. Do not edit files under .cursor. After the command finishes or is denied, write docs/loops/qa-driver-cursor-positive-report.md so its last non-blank line is exactly the marker in the standing instruction below. Then stop.'
$wrapPrompt = 'You are a stub. Run this exact shell command and no other shell command: node docs/loops/qa-9994/push-qa.mjs qa/zz-probe-allowed. Do not edit files under .cursor. After it finishes, write docs/loops/qa-driver-cursor-wrap-report.md so its last non-blank line is exactly the marker in the standing instruction below. Then stop.'
$queuePrompt = 'You are a stub. Write docs/loops/qa-9996-stub-report.md so its last non-blank line is exactly the marker in the standing instruction below. Do not run git. Do not push. Then stop.'
Invoke-Copy '9995' 'docs/loops/qa-driver-cursor-probe-report.md' 'zz-probe' $pushPrompt
Invoke-Copy '9993' 'docs/loops/qa-driver-cursor-positive-report.md' 'zz-probe' $positivePrompt
Invoke-Copy '9994' 'docs/loops/qa-driver-cursor-wrap-report.md' 'zz-probe' $wrapPrompt
Invoke-Copy '9996' 'docs/loops/qa-9996-stub-report.md' 'zz-probe' $queuePrompt
git -C $tree add docs
git -C $tree commit -q -m drivers

function Start-Hidden([string] $commandLine) {
  $si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
  $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; ProcessStartupInformation = $si }
  if ($created.ReturnValue -ne 0) { throw "Create failed $($created.ReturnValue)" }
  return [int]$created.ProcessId
}
function Test-NoWindow([int] $procId) {
  Start-Sleep -Seconds 3
  $bad = @()
  $ids = New-Object System.Collections.Generic.List[int]
  $ids.Add($procId)
  Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $procId } | ForEach-Object { $ids.Add([int]$_.ProcessId) }
  foreach ($id in $ids) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p -and $p.MainWindowHandle -ne 0) { $bad += "$($p.ProcessName):$id handle=$($p.MainWindowHandle)" }
  }
  return $bad
}
function Stop-Tree([int] $procId) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  taskkill /PID $procId /T /F 2>$null | Out-Null
  $ErrorActionPreference = $old
}
function Wait-Done([string] $done, [int] $procId, [int] $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $done) { return $true }
    if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { Start-Sleep -Seconds 1; return (Test-Path -LiteralPath $done) }
    Start-Sleep -Seconds 2
  }
  return $false
}
function Invoke-Driver([string] $n, [int] $seconds) {
  $driver = Join-Path $tree "docs\loops\qa-$n\drive.ps1"
  $cmd = "cmd.exe /d /c set `"USERPROFILE=$profileDir`"&& set `"LOCALAPPDATA=$localApp`"&& `"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$driver`""
  $procId = Start-Hidden $cmd
  $windows = @(Test-NoWindow $procId)
  if ($windows.Count -gt 0) {
    Stop-Tree $procId
    throw "visible window: $($windows -join ', ')"
  }
  $done = Join-Path $profileDir "sia-qa$n\done"
  $ok = Wait-Done $done $procId $seconds
  if (-not $ok) { Stop-Tree $procId; throw "driver $n did not finish" }
  $meta = Get-Content -LiteralPath (Join-Path $profileDir "sia-qa$n\drive.meta") -Encoding utf8
  return $meta
}
function Remote-Has([string] $ref) {
  git --git-dir=$bare show-ref --verify --quiet $ref
  return $LASTEXITCODE -eq 0
}

if (-not $QueueOnly) {
  $meta = Invoke-Driver '9995' 240
  $changed = @($meta | Where-Object { $_ -like 'refs_changed=*' })
  $denial = @($meta | Where-Object { $_ -like 'denial=*' -or $_ -like 'attempt_*=*denial=*' })
  $moved = Remote-Has 'refs/heads/qa/zz-probe-1'
  Say ("refuse changed=" + ($changed -join ' | '))
  Say ("refuse denial_lines=" + (($denial | Select-Object -First 4) -join ' | '))
  Say "refuse remote_moved=$moved"
  if ($moved) { Say 'FAIL force bypassed the deny list'; exit 2 }
  $denied = @($meta | Where-Object { $_ -like 'denial=*' -and $_ -notlike 'denial=' })
  if ($denied.Count -eq 0) { Say 'FAIL push was not denied and did not move; the deny was not exercised'; exit 3 }

  git -C $tree branch qa/zz-probe-allowed
  $meta = Invoke-Driver '9994' 240
  $wrapped = Remote-Has 'refs/heads/qa/zz-probe-allowed'
  Say "wrap remote_moved=$wrapped"
  if (-not $wrapped) { Say 'FAIL push-qa did not push while the deny list was installed'; exit 4 }
  git --git-dir=$bare update-ref -d refs/heads/qa/zz-probe-allowed
  git -C $tree branch -D qa/zz-probe-allowed | Out-Null

  $cli = Join-Path $tree 'docs\loops\qa-9993\cli.json'
  Set-Content -LiteralPath $cli -Value '{"permissions":{"allow":[],"deny":[]}}' -Encoding ascii
  $meta = Invoke-Driver '9993' 240
  $pushed = Remote-Has 'refs/heads/qa/zz-probe-1'
  Say "positive remote_moved=$pushed"
  if (-not $pushed) { Say 'FAIL known positive did not push'; exit 5 }
  git --git-dir=$bare update-ref -d refs/heads/qa/zz-probe-1
}

$queue = Join-Path $tree 'docs\loops\qa-queue.ps1'
$qcmd = "cmd.exe /d /c set `"USERPROFILE=$profileDir`"&& set `"LOCALAPPDATA=$localApp`"&& `"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$queue`" -Queue 9996 -QuietCpuPercent 101 -QuietWaitMinutes 0 -TimeoutMinutes 8 -StartWaitMinutes 1"
$qpid = Start-Hidden $qcmd
$windows = @(Test-NoWindow $qpid)
if ($windows.Count -gt 0) { Stop-Tree $qpid; throw "visible window on queue: $($windows -join ', ')" }
$qdone = Join-Path $profileDir 'sia-qa9996\done'
if (-not (Wait-Done $qdone $qpid 480)) { Stop-Tree $qpid; throw 'queue driver did not finish' }
$report = Join-Path $tree 'docs\loops\qa-9996-stub-report.md'
$last = ''
if (Test-Path -LiteralPath $report) { $last = @(Get-Content -LiteralPath $report -Encoding utf8 | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 1) }
Say "queue last=$last"
if ($last -ne 'QA-9996: REPORT COMPLETE') { Say 'FAIL queue stub report'; exit 6 }
Say 'PASS'
exit 0
