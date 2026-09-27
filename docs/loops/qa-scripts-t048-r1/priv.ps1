# QA 151: the control: the same launch path as nopriv.ps1 with SeBackupPrivilege left as inherited.
"PRIV: " + ((& "$env:WINDIR\System32\whoami.exe" /priv | Select-String -Pattern 'SeBackupPrivilege').ToString() -replace '\s+', ' ')
& node @args 2>&1 | ForEach-Object { "$_" }
"EXIT: $LASTEXITCODE"
