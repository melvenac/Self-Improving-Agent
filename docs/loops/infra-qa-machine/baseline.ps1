# G-042 second-machine baseline (Forge, record 97, D-045): the full suite ONCE on origin/master.
# Launched detached (Win32_Process.Create) so it survives the SSH session; poll the files below.
$d = Join-Path $env:TEMP 'sia-setup'
Set-Location (Join-Path $env:USERPROFILE 'Worktrees\sia-qa\open-brain')
Remove-Item "$d\baseline.*" -ErrorAction SilentlyContinue
$start = Get-Date
"start=$($start.ToUniversalTime().ToString('o'))" | Out-File "$d\baseline.meta" -Encoding ascii
"head=$(git rev-parse HEAD)" | Add-Content "$d\baseline.meta" -Encoding ascii
# Redirect, not a pipe: cmd's exit code IS npm's exit code.
cmd /c "npm test > `"$d\baseline.log`" 2>&1"
$rc = $LASTEXITCODE
$end = Get-Date
"end=$($end.ToUniversalTime().ToString('o'))" | Add-Content "$d\baseline.meta" -Encoding ascii
"exit=$rc" | Add-Content "$d\baseline.meta" -Encoding ascii
"wall_s=$([math]::Round(($end - $start).TotalSeconds, 2))" | Add-Content "$d\baseline.meta" -Encoding ascii
'done' | Out-File "$d\baseline.done" -Encoding ascii
