# QA 151: hold each file open with share None until the sentinel file disappears. Usage: hold.ps1 -Sentinel <p> <files...>
param([string]$Sentinel, [Parameter(ValueFromRemainingArguments=$true)][string[]]$Files)
$h = @(); foreach ($f in $Files) { $h += [IO.File]::Open($f, 'Open', 'Read', 'None') }
"HELD $($h.Count)" | Out-File "$Sentinel.ready" -Encoding ascii
while (Test-Path $Sentinel) { Start-Sleep -Milliseconds 200 }
$h | ForEach-Object { $_.Close() }
