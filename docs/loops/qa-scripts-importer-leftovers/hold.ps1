param([string]$Path, [string]$Share = 'None', [string]$Access = 'Read', [string]$Mode = 'Open', [int]$Seconds = 20)
$fs = [IO.File]::Open($Path, $Mode, $Access, $Share)
"HELD pid=$PID share=$Share access=$Access mode=$Mode" | Out-File -Encoding ascii ($Path + '.held')
Start-Sleep -Seconds $Seconds
$fs.Close()
