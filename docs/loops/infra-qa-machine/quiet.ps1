"cpu load %: $((Get-CimInstance Win32_Processor).LoadPercentage)"
"free RAM GB: $([math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,2))"
"node/claude/vitest processes: " + ((Get-Process node,claude -ErrorAction SilentlyContinue | Measure-Object).Count)
"interactive users: " + ((query user 2>$null) -join ' | ')
