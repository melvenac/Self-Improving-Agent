# QA 298 / BRIEFING-FIX BF-A6: #498 P1 under a REAL Windows ACL. Run as:
#   powershell -NoProfile -ExecutionPolicy Bypass -File bf-a6.ps1 -Cli <path to built cli.js> -Fixture <path to fixtures-state/state.json>
# Every ACL change is undone in a finally block. icacls is printed before and after each case.
param([Parameter(Mandatory)][string]$Cli, [Parameter(Mandatory)][string]$Fixture)
$ErrorActionPreference = "Stop"
# QA 298-r2: an elevated token (SeBackupPrivilege/SeRestorePrivilege ENABLED) gets past DENY ACEs via libuv backup
# semantics, so the ACL never reaches node. Such a session cannot exercise P1: STOP (exit 3 = INCOMPLETE).
"=== PRIVILEGE PREFLIGHT"
whoami /groups | Select-String "Mandatory Label"
$bad = whoami /priv | Where-Object { $_ -match '^(SeBackupPrivilege|SeRestorePrivilege)\s' -and $_ -match 'Enabled\s*$' }
if ($bad) { "STOP INCOMPLETE: elevated session"; $bad; exit 3 }
"privileges OK: no Backup/Restore privilege enabled"
$root = "C:\qa-tmp\qa298"
$repo = Join-Path $root "repo"
if (Test-Path $repo) { "REFUSED: $repo exists; use a fresh C:\qa-tmp\qa298"; exit 2 }
New-Item -ItemType Directory -Force (Join-Path $repo ".agents"), (Join-Path $repo ".claude\commands") | Out-Null
Copy-Item $Fixture (Join-Path $repo ".agents\state.json")
Set-Content (Join-Path $repo ".claude\commands\keep.txt") "keep" -Encoding ascii
git -C $repo init -q -b main
git -C $repo config core.autocrlf false
git -C $repo config user.email "qa298@example.com"
git -C $repo config user.name "QA 298"
git -C $repo add -A
git -C $repo commit -q -m "QA 298 fixture"
Set-Content (Join-Path $repo "stray.txt") "stray" -Encoding ascii   # dirty path outside the import allowlist
$who = "$env:USERDOMAIN\$env:USERNAME"
$cmds = Join-Path $repo ".claude\commands"
$stray = Join-Path $repo "stray.txt"

"=== CASE 1 (P1a): .claude/commands unwritable (deny W) AND a dirty path. Expect the permissions message, NOT 'commit or stash'"
"--- icacls before:"; icacls $cmds
try {
  icacls $cmds /deny "${who}:(W)" | Out-Null
  "--- icacls during:"; icacls $cmds
  $out = cmd /c "node `"$Cli`" bootstrap install-commands `"$repo`" 2>&1" | Out-String
  "EXIT=$LASTEXITCODE"; "--- output:"; $out
  "CASE1 has 'not writable': $($out -match 'is not writable')"
  "CASE1 has 'commit or stash': $($out -match 'commit or stash')"
} finally {
  icacls $cmds /remove:d $who | Out-Null
  "--- icacls after (restored):"; icacls $cmds
}

"=== CASE 2 (P1b): the dirty file itself unreadable (deny R), directory writable. Expect 'is not readable (permissions)'"
"--- icacls before:"; icacls $stray
try {
  icacls $stray /deny "${who}:(R)" | Out-Null
  "--- icacls during:"; icacls $stray
  $out2 = cmd /c "node `"$Cli`" bootstrap install-commands `"$repo`" 2>&1" | Out-String
  "EXIT=$LASTEXITCODE"; "--- output:"; $out2
  "CASE2 has 'is not readable (permissions)': $($out2 -match 'is not readable \(permissions\)')"
  "CASE2 has 'commit or stash': $($out2 -match 'commit or stash')"
} finally {
  icacls $stray /remove:d $who | Out-Null
  "--- icacls after (restored):"; icacls $stray
}

"=== NOTHING WRITTEN check: .claude/commands lists only keep.txt"
Get-ChildItem $cmds -Name
"=== DONE"
