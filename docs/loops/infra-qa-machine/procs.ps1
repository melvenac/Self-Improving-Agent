Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'node.exe','claude.exe','Code.exe' } | ForEach-Object {
  $c = ($_.CommandLine -replace '\s+', ' '); if ($c.Length -gt 160) { $c = $c.Substring(0,160) }
  '{0} {1} {2}MB started {3} session {4} :: {5}' -f $_.ProcessId, $_.Name, [math]::Round($_.WorkingSetSize/1MB), $_.CreationDate.ToString('HH:mm'), $_.SessionId, $c
}
