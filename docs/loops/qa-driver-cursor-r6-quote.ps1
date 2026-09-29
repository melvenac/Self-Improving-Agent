# Row (a) for record 192 r6. Runs the product template's drive.ps1 (or -Rev / -DrivePath)
# once, with MaxContinuations 0, and requires the first user event to contain
# stops.txt's quoted text byte for byte.
param(
  [string] $DrivePath = '',
  [string] $Rev = ''
)
$ErrorActionPreference = 'Stop'
function ConvertTo-Quoted([string] $s) {
  if ($s -notmatch '[\s"]') { return $s }
  return '"' + ($s -replace '"', '\"') + '"'
}
function Add-Text($o, $sb) {
  if ($null -eq $o) { return }
  if ($o -is [string]) { [void]$sb.Append($o); return }
  if ($o -is [System.Array]) { foreach ($i in $o) { Add-Text $i $sb }; return }
  foreach ($p in @($o.PSObject.Properties)) { Add-Text $p.Value $sb }
}
$repo = (git rev-parse --show-toplevel).Trim()
$template = Join-Path $repo 'docs\loops\qa-driver-template-cursor'
$stopsSrc = Join-Path $template 'stops.txt'
$quoted = [regex]::Match([IO.File]::ReadAllText($stopsSrc), '"[^"\r\n]+"').Value
if (-not $quoted) { Write-Output 'FAIL stops.txt has no quoted span'; exit 1 }
Write-Output "quoted_span=$quoted"

$scratch = Join-Path 'C:\qa-tmp' ("qa-r6-quote-" + $PID)
if (Test-Path -LiteralPath $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
$profile = Join-Path $scratch 'profile'
$tree = Join-Path $profile 'Worktrees\sia-qa'
$stopsDst = Join-Path $tree 'docs\loops\qa-99'
New-Item -ItemType Directory -Force -Path $stopsDst | Out-Null
Copy-Item -LiteralPath $stopsSrc -Destination (Join-Path $stopsDst 'stops.txt')
Push-Location $tree
git init -q -b master
git add -- 'docs/loops/qa-99/stops.txt'
git -c user.email=qa@example.com -c user.name=qa commit -q -m init
Pop-Location

$drive = $DrivePath
if ($Rev) {
  $drive = Join-Path $scratch 'drive.ps1'
  git -C $repo show "${Rev}:docs/loops/qa-driver-template-cursor/drive.ps1" | Set-Content -LiteralPath $drive -Encoding utf8
  Copy-Item -LiteralPath (Join-Path $template 'cli.json') -Destination (Join-Path $scratch 'cli.json')
}
if (-not $drive) { $drive = Join-Path $template 'drive.ps1' }
Write-Output "drive=$drive"

$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arg = '-NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-Quoted $drive) + ' -MaxContinuations 0'
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $ps
$psi.Arguments = $arg
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables['USERPROFILE'] = $profile
$psi.EnvironmentVariables['LOCALAPPDATA'] = $env:LOCALAPPDATA
$proc = [Diagnostics.Process]::Start($psi)
if (-not $proc.WaitForExit(360000)) {
  & taskkill.exe /T /F /PID $proc.Id | Out-Null
  Write-Output 'FAIL template launch timed out'
  exit 1
}
Write-Output "drive_exit=$($proc.ExitCode)"

$jsonl = Join-Path $profile 'sia-qa99\run-0.jsonl'
if (-not (Test-Path -LiteralPath $jsonl)) { Write-Output 'FAIL no run-0.jsonl'; exit 1 }
$user = ''
foreach ($line in [IO.File]::ReadAllLines($jsonl)) {
  if ($line -notmatch '"type"\s*:\s*"user"') { continue }
  try { $o = $line | ConvertFrom-Json } catch { continue }
  $sb = New-Object System.Text.StringBuilder
  Add-Text $o $sb
  $user = $sb.ToString()
  break
}
if (-not $user) { Write-Output 'FAIL no user event'; exit 1 }
if ($user.Contains($quoted)) {
  Write-Output 'template_quotes_kept=True'
  exit 0
}
Write-Output 'FAIL template_quotes_stripped'
Write-Output ('user_has_quotes=' + $user.Contains('"'))
exit 1
