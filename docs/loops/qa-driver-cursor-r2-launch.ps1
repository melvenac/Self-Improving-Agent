# Launch cursor-agent's node entry with Windows argv quoting intact.
# cursor-agent.ps1 forwards $args to node.exe. PowerShell 5.1 drops embedded
# double quotes on that hop, so a prompt of cmd /c "cd . && node ..." arrives as
# cmd /c cd . && node ... and the shell splits on &&.
function ConvertTo-WinArg([string] $s) {
  if ($s -notmatch '[\s"]') { return $s }
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  $slashes = 0
  foreach ($ch in $s.ToCharArray()) {
    if ($ch -eq '\') { $slashes++; continue }
    if ($ch -eq '"') {
      [void]$sb.Append('\', ($slashes * 2 + 1))
      [void]$sb.Append('"')
      $slashes = 0
      continue
    }
    if ($slashes -gt 0) { [void]$sb.Append('\', $slashes); $slashes = 0 }
    [void]$sb.Append($ch)
  }
  if ($slashes -gt 0) { [void]$sb.Append('\', ($slashes * 2)) }
  [void]$sb.Append('"')
  return $sb.ToString()
}

function Parse-CursorVersion([string] $versionString) {
  $parts = $versionString.Split('-')[0].Split('.')
  if ($parts.Length -ne 3) { throw "Invalid cursor-agent version: $versionString" }
  return [int]($parts[0] + $parts[1].PadLeft(2, '0') + $parts[2].PadLeft(2, '0'))
}

function Resolve-CursorNode {
  $scriptPath = Join-Path $env:LOCALAPPDATA 'cursor-agent'
  if (Test-Path -LiteralPath (Join-Path $scriptPath 'node.exe')) {
    return @{ node = (Join-Path $scriptPath 'node.exe'); index = (Join-Path $scriptPath 'index.js') }
  }
  $versionDir = Get-ChildItem -LiteralPath (Join-Path $scriptPath 'versions') -Directory |
    Where-Object { $_.Name -match '^\d{4}\.\d{1,2}\.\d{1,2}(-\d{2}-\d{2}-\d{2})?-[a-f0-9]+$' } |
    Sort-Object { Parse-CursorVersion $_.Name } -Descending |
    Select-Object -First 1
  if (-not $versionDir) { throw "cursor-agent node not found under $scriptPath" }
  $ver = Join-Path (Join-Path $scriptPath 'versions') $versionDir.Name
  return @{ node = (Join-Path $ver 'node.exe'); index = (Join-Path $ver 'index.js') }
}

function Invoke-CursorAgentQuoted([string] $Prompt, [string] $Jsonl, [string] $Err, [string] $Workspace, [string] $Model) {
  $env:CURSOR_INVOKED_AS = 'agent.cmd'
  $bin = Resolve-CursorNode
  $pieces = @(
    (ConvertTo-WinArg $bin.index),
    (ConvertTo-WinArg '-p'),
    (ConvertTo-WinArg $Prompt),
    (ConvertTo-WinArg '--model'),
    (ConvertTo-WinArg $Model),
    (ConvertTo-WinArg '--output-format'),
    (ConvertTo-WinArg 'stream-json'),
    (ConvertTo-WinArg '--trust'),
    (ConvertTo-WinArg '--force'),
    (ConvertTo-WinArg '--workspace'),
    (ConvertTo-WinArg $Workspace)
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $bin.node
  $psi.Arguments = ($pieces -join ' ')
  $psi.WorkingDirectory = $Workspace
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $proc = [Diagnostics.Process]::Start($psi)
  $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
  $stderrTask = $proc.StandardError.ReadToEndAsync()
  $proc.WaitForExit()
  [void]$stdoutTask.Wait()
  [void]$stderrTask.Wait()
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllText($Jsonl, $stdoutTask.Result, $utf8)
  [IO.File]::WriteAllText($Err, $stderrTask.Result, $utf8)
  return $proc.ExitCode
}
