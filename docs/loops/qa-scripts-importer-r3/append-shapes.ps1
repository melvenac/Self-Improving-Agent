$ErrorActionPreference = 'Stop'
$d = 'C:\qa-scratch\qa111\psappend'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$base = "# Inbox " + [char]0x2014 + " priorities`r`n`r`n> **Last Updated:** Session 6`r`n"
# 1: UTF-8 (no BOM) file, then `>>` append
[IO.File]::WriteAllText("$d\u8-redirappend.md", $base, $utf8)
"- [ ] appended " + [char]0x2014 + " by >>" >> "$d\u8-redirappend.md"
# 2: UTF-8 (no BOM) file, then Add-Content
[IO.File]::WriteAllText("$d\u8-addcontent.md", $base, $utf8)
Add-Content -Path "$d\u8-addcontent.md" -Value ("- [ ] appended " + [char]0x2014 + " by Add-Content")
# 3: UTF-8 BOM file (Out-File -Encoding utf8), then Add-Content
$base | Out-File -FilePath "$d\u8bom-addcontent.md" -Encoding utf8 -NoNewline
Add-Content -Path "$d\u8bom-addcontent.md" -Value ("- [ ] appended " + [char]0x2014 + " by Add-Content")
# 4: UTF-8 BOM file, then >>
$base | Out-File -FilePath "$d\u8bom-redirappend.md" -Encoding utf8 -NoNewline
"- [ ] appended " + [char]0x2014 + " by >>" >> "$d\u8bom-redirappend.md"
# 5: Set-Content (1252) file, then >>
Set-Content -Path "$d\cp-redirappend.md" -Value $base -NoNewline
"- [ ] appended " + [char]0x2014 + " by >>" >> "$d\cp-redirappend.md"
# 6: UTF-16LE file (>), then Add-Content
$base > "$d\u16-addcontent.md"
Add-Content -Path "$d\u16-addcontent.md" -Value ("- [ ] appended " + [char]0x2014 + " by Add-Content")
$PSVersionTable.PSVersion.ToString()
