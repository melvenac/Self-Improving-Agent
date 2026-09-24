$ps = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$env:TEMP\sia-setup\baseline.ps1`""
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $ps }
"launched: ReturnValue=$($r.ReturnValue) ProcessId=$($r.ProcessId)"
