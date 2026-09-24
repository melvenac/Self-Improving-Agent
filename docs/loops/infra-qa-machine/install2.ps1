# SIA QA machine setup (Forge, record session 97, D-045): official installers, sha256-verified, silent.
# winget's source fails in a non-interactive SSH session, so this is the fallback the brief names.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Join-Path $env:TEMP 'sia-setup'

function Get-Verified($url, $file, $sha256) {
  $path = Join-Path $dir $file
  Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing
  $got = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
  if ($got -ne $sha256.ToLower()) { throw "sha256 mismatch for ${file}: got $got, want $sha256" }
  Write-Host "  verified $file sha256 $got"
  return $path
}
function Get-GhAsset($repo, $pattern) {
  $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'sia-setup' }
  $a = $rel.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
  if (-not $a) { throw "no asset matching $pattern in $repo $($rel.tag_name)" }
  if (-not $a.digest) { throw "no digest published for $($a.name)" }
  return @{ tag = $rel.tag_name; name = $a.name; url = $a.browser_download_url; sha = ($a.digest -replace '^sha256:','') }
}

# Git for Windows
$g = Get-GhAsset 'git-for-windows/git' '^Git-[0-9.]+-64-bit\.exe$'
Write-Output "=== Git for Windows $($g.tag) ($($g.name))"
$p = Get-Verified $g.url $g.name $g.sha
$proc = Start-Process $p -ArgumentList '/VERYSILENT','/NORESTART','/NOCANCEL','/SP-','/SUPPRESSMSGBOXES' -Wait -PassThru
Write-Output "  exit=$($proc.ExitCode)"

# Node 22 LTS
$idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
$v = ($idx | Where-Object { $_.version -like 'v22.*' } | Select-Object -First 1).version
$msi = "node-$v-x64.msi"
$sums = (Invoke-WebRequest "https://nodejs.org/dist/$v/SHASUMS256.txt" -UseBasicParsing).Content
$sha = (($sums -split "`n") | Where-Object { $_ -match "  $([regex]::Escape($msi))$" } | Select-Object -First 1).Split(' ')[0]
Write-Output "=== Node $v ($msi)"
$p = Get-Verified "https://nodejs.org/dist/$v/$msi" $msi $sha
$proc = Start-Process msiexec.exe -ArgumentList '/i', "`"$p`"", '/qn', '/norestart' -Wait -PassThru
Write-Output "  exit=$($proc.ExitCode)"

# GitHub CLI
$h = Get-GhAsset 'cli/cli' '^gh_[0-9.]+_windows_amd64\.msi$'
Write-Output "=== GitHub CLI $($h.tag) ($($h.name))"
$p = Get-Verified $h.url $h.name $h.sha
$proc = Start-Process msiexec.exe -ArgumentList '/i', "`"$p`"", '/qn', '/norestart' -Wait -PassThru
Write-Output "  exit=$($proc.ExitCode)"
