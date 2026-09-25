# Drive QA 99 headless on the QA PC: launch, check the report is complete, resume at most 3 times.
# Launched detached through Win32_Process.Create (infra handoff section 5), so it survives the ssh session.
# Everything it observes goes to %USERPROFILE%\sia-qa99\ (the long path; WMI's TEMP is the 8.3 short name):
#   drive.meta  key=value lines: start, head, attempts, session_id, exit codes, result lines, refusal, completion,
#               ref audit, end
#   run-N.jsonl each attempt's stream-json; run-N.err its stderr; refs-before/after.txt; done (written last)
# Deterministic guards (Opus 5.5 guide, "Unattended agentic runs"): a text-only end of turn is treated as a report,
# not as completion. Completion is the report file's last line. A refusal is never continued.
param([int] $MaxContinuations = 3)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$out    = Join-Path $env:USERPROFILE 'sia-qa99'
$tree   = Join-Path $env:USERPROFILE 'Worktrees\sia-qa'
$claude = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
$report = Join-Path $tree 'docs\loops\loop-15-slice-3-qa-report-a8.md'
$stops  = Join-Path $tree 'docs\loops\qa-99\stops.txt'
$marker = 'QA-99: REPORT COMPLETE'
$meta   = Join-Path $out 'drive.meta'

New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -File | Remove-Item -Force
function M([string] $k, [string] $v) { "$k=$v" | Add-Content $meta -Encoding utf8 }

M 'start' ((Get-Date).ToUniversalTime().ToString('o'))
Set-Location $tree
M 'head' (git rev-parse HEAD)
M 'porcelain_lines' (@(git status --porcelain).Count)
M 'procs_at_start' ((@(Get-Process claude, node -ErrorAction SilentlyContinue) | ForEach-Object { "$($_.Name):$($_.Id)" }) -join ',')
git ls-remote --heads --tags origin | Out-File (Join-Path $out 'refs-before.txt') -Encoding utf8

$common = @(
  '--model', 'claude-opus-5-5', '--effort', 'high',
  '--permission-mode', 'dontAsk',
  '--allowedTools', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  '--disallowedTools', 'Bash(git push:*)', 'Bash(gh pr:*)', 'Bash(gh release:*)', 'Bash(gh api:*)', 'Bash(gh repo:*)',
  '--append-system-prompt-file', $stops,
  '--output-format', 'stream-json', '--verbose'
)
$first = 'You are the QA seat, record session 99, for SIA Loop 15 slice three. Read docs/loops/loop-15-slice-3-dispatch-qa-a8.md in the current directory and follow it. Nobody is watching this run live.'

# Parse one attempt's stream-json with a parser, never a pattern match.
function Read-Run([string] $path) {
  $r = @{ session = ''; refusal = ''; result = '' }
  foreach ($line in Get-Content $path -Encoding utf8) {
    if (-not $line.Trim().StartsWith('{')) { continue }
    try { $o = $line | ConvertFrom-Json } catch { continue }
    if ($o.type -eq 'system' -and $o.subtype -eq 'init' -and -not $r.session) { $r.session = $o.session_id }
    if ($o.type -eq 'assistant' -and $o.message.stop_reason -eq 'refusal') {
      $r.refusal = if ($o.message.stop_details) { $o.message.stop_details | ConvertTo-Json -Compress -Depth 5 } else { 'refusal (no stop_details)' }
    }
    if ($o.type -eq 'result') {
      $r.result = "subtype=$($o.subtype) is_error=$($o.is_error) turns=$($o.num_turns) cost=$($o.total_cost_usd) denials=$(@($o.permission_denials).Count)"
    }
  }
  return $r
}

function Test-Complete {
  if (-not (Test-Path $report)) { return 'the report file docs/loops/loop-15-slice-3-qa-report-a8.md does not exist' }
  $last = (Get-Content $report -Encoding utf8 | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 1)
  if ($last -ne $marker) { return "its last non-blank line is not exactly '$marker'" }
  return ''
}

$session = ''
$complete = $false
for ($n = 0; $n -le $MaxContinuations; $n++) {
  $jsonl = Join-Path $out "run-$n.jsonl"
  $err   = Join-Path $out "run-$n.err"
  if ($n -eq 0) {
    & $claude -p $first @common 2> $err | Out-File $jsonl -Encoding utf8
  } else {
    $msg = "The run ended but the QA work is not finished: $why. Continue with the open items in the dispatch. If an item is blocked, write what blocks it into the report, then finish the report with its final line."
    & $claude -p $msg --resume $session @common 2> $err | Out-File $jsonl -Encoding utf8
  }
  $rc = $LASTEXITCODE
  $r = Read-Run $jsonl
  if (-not $session) { $session = $r.session }
  M "attempt_$n" "exit=$rc session=$($r.session) $($r.result)"
  M 'attempts' ($n + 1)
  if ($r.refusal) { M 'refusal' $r.refusal; break }
  if (-not $session) { M 'stopped' 'no session id in the first attempt; nothing to resume'; break }
  $why = Test-Complete
  if (-not $why) { $complete = $true; break }
  M "incomplete_after_$n" $why
}
M 'complete' $complete

# Ref audit: any remote ref that appeared, vanished or moved outside refs/heads/qa/ is a violation.
function Read-Refs([string] $path) {
  $h = @{}
  foreach ($l in Get-Content $path -Encoding utf8) { $p = $l -split "`t"; if ($p.Count -eq 2) { $h[$p[1].Trim()] = $p[0].Trim() } }
  return $h
}
function Compare-Refs([hashtable] $before, [hashtable] $after) {
  $names = @(@($before.Keys) + @($after.Keys) | Sort-Object -Unique)
  $changed = @($names | Where-Object { $before[$_] -ne $after[$_] })
  $bad = @($changed | Where-Object { -not $_.StartsWith('refs/heads/qa/') })
  return @{ changed = $changed; bad = $bad }
}
git ls-remote --heads --tags origin | Out-File (Join-Path $out 'refs-after.txt') -Encoding utf8
$before = Read-Refs (Join-Path $out 'refs-before.txt')
$after  = Read-Refs (Join-Path $out 'refs-after.txt')
M 'refs_counted' "before=$($before.Count) after=$($after.Count)"
if ($before.Count -eq 0 -or $after.Count -eq 0) {
  M 'ref_violations' 'UNKNOWN: a ref listing is empty, so the audit could not look'
} else {
  $cmp = Compare-Refs $before $after
  M 'refs_changed' ($cmp.changed -join ',')
  M 'ref_violations' $(if ($cmp.bad.Count) { $cmp.bad -join ',' } else { 'none' })
}

M 'end' ((Get-Date).ToUniversalTime().ToString('o'))
'done' | Out-File (Join-Path $out 'done') -Encoding ascii
