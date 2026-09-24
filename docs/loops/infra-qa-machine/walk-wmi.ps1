# Run walk.cjs in the SAME launch context as the baseline (Win32_Process.Create), output to a file.
$d = Join-Path $env:TEMP 'sia-setup'
$out = Join-Path $d 'walk-wmi.txt'
Remove-Item $out -ErrorAction SilentlyContinue
$inner = "cmd /c `"echo TEMP=%TEMP%& echo USERPROFILE=%USERPROFILE%& whoami /groups | findstr /i `"Mandatory`"& node -e `"console.log('os.tmpdir()='+require('os').tmpdir())`"& node `"$d\walk.cjs`"`" > `"$out`" 2>&1"
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $inner; CurrentDirectory = $d }
"launched: ReturnValue=$($r.ReturnValue) ProcessId=$($r.ProcessId)"
Start-Sleep -Seconds 6
Get-Content $out
"--- same diagnostics in THIS ssh session:"
"TEMP=$env:TEMP"
whoami /groups | findstr /i "Mandatory"
