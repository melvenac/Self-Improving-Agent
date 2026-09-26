# Waits until the box is quiet enough for the full suite (atlas's rule, record 109):
# cursor-agent (pid 2604) under 0.2 CPU-seconds per 5 s for 12 consecutive samples (one minute),
# AND total load under 20% on the last 3 samples. Bound: 20 minutes. Every sample is logged.
param([string]$Log, [int]$AgentPid = 2604)
$deadline = (Get-Date).AddMinutes(20)
$agentRun = 0; $loads = @()
"start $(Get-Date -Format o); rule: pid $AgentPid < 0.2 CPU-s/5s x12 AND load < 20% x3; bound 20 min" | Out-File -Encoding utf8 $Log
function AgentCpu { $p = Get-Process -Id $AgentPid -ErrorAction SilentlyContinue; if ($p) { $p.CPU } else { $null } }
$prev = AgentCpu
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 5
  $now = AgentCpu
  $delta = if ($null -eq $now) { 0 } elseif ($null -eq $prev) { 0 } else { [math]::Round($now - $prev, 2) }
  $prev = $now
  $load = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $loads = @($loads + $load) | Select-Object -Last 3
  if ($delta -lt 0.2) { $agentRun++ } else { $agentRun = 0 }
  $alive = if ($null -eq $now) { "gone" } else { "alive" }
  "$(Get-Date -Format o) agent($alive) dCPU=$delta run=$agentRun load=$load%" | Out-File -Append -Encoding utf8 $Log
  if ($agentRun -ge 12 -and $loads.Count -eq 3 -and ($loads | Where-Object { $_ -ge 20 }).Count -eq 0) {
    "QUIET $(Get-Date -Format o)" | Out-File -Append -Encoding utf8 $Log; Write-Output "QUIET"; exit 0
  }
}
"TIMEOUT $(Get-Date -Format o)" | Out-File -Append -Encoding utf8 $Log; Write-Output "TIMEOUT"; exit 3
