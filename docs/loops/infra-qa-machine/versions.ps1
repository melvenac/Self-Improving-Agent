# Fresh-session version check: read PATH from the registry, as a new SSH login would get it.
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
foreach ($c in 'git','node','npm','gh') {
  $cmd = Get-Command $c -ErrorAction SilentlyContinue
  if ($cmd) { Write-Output ("{0}: {1}  [{2}]" -f $c, ((& $c --version 2>&1) | Select-Object -First 1), $cmd.Source) } else { Write-Output "${c}: NOT FOUND" }
}
