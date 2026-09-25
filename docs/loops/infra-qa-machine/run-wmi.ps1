# Run one command in open-brain through Win32_Process.Create (the baseline's launch context), detached.
# Usage: run-wmi.ps1 -Name <tag> -Cmd "<cmd.exe command line>"
# Writes %TEMP%\sia-setup\<tag>.log, <tag>.meta (start, head, end, exit, wall_s) and <tag>.done.
# -Direct runs the same inner script synchronously in THIS (ssh) session instead, for comparison.
param([Parameter(Mandatory)] [string] $Name, [Parameter(Mandatory)] [string] $Cmd, [switch] $Direct)
$d = Join-Path $env:TEMP 'sia-setup'
$ob = Join-Path $env:USERPROFILE 'Worktrees\sia-qa\open-brain'
$inner = Join-Path $d "$Name.inner.ps1"
@"
Set-Location '$ob'
`$d = '$d'
Remove-Item "`$d\$Name.log","`$d\$Name.meta","`$d\$Name.done" -ErrorAction SilentlyContinue
`$start = Get-Date
"start=`$(`$start.ToUniversalTime().ToString('o'))" | Out-File "`$d\$Name.meta" -Encoding ascii
"head=`$(git rev-parse HEAD)" | Add-Content "`$d\$Name.meta" -Encoding ascii
cmd /c "$Cmd > ```"`$d\$Name.log```" 2>&1"
`$rc = `$LASTEXITCODE
`$end = Get-Date
"end=`$(`$end.ToUniversalTime().ToString('o'))" | Add-Content "`$d\$Name.meta" -Encoding ascii
"exit=`$rc" | Add-Content "`$d\$Name.meta" -Encoding ascii
"wall_s=`$([math]::Round((`$end - `$start).TotalSeconds, 2))" | Add-Content "`$d\$Name.meta" -Encoding ascii
'done' | Out-File "`$d\$Name.done" -Encoding ascii
"@ | Out-File $inner -Encoding utf8
if ($Direct) {
  powershell -NoProfile -ExecutionPolicy Bypass -File $inner
  "ran $Name directly in this session"
  Get-Content (Join-Path $d "$Name.meta")
} else {
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$inner`"" }
  "launched $Name`: ReturnValue=$($r.ReturnValue) ProcessId=$($r.ProcessId)"
}
