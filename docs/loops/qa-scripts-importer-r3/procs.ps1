# QA 106: the processes on this PC that could compete with the full suite (node, claude, powershell, vitest workers),
# with their command lines, plus total CPU load. Usage: powershell -File procs.ps1 > out.txt
"utc: " + (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
"cpu load %: " + (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -in @('node.exe', 'claude.exe', 'powershell.exe', 'pwsh.exe', 'git.exe', 'MsMpEng.exe') } |
  Sort-Object Name, ProcessId |
  ForEach-Object {
    $c = if ($_.CommandLine) { $_.CommandLine.Substring(0, [Math]::Min(160, $_.CommandLine.Length)) } else { '' }
    "{0,-15} pid {1,-6} ppid {2,-6} {3}" -f $_.Name, $_.ProcessId, $_.ParentProcessId, $c
  }
