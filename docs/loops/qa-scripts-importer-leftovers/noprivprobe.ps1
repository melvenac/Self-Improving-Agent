param([string]$Script, [string]$Wt, [string]$Out)
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Tok {
  [StructLayout(LayoutKind.Sequential, Pack=1)] public struct TP { public int Count; public long Luid; public int Attr; }
  [DllImport("advapi32.dll", SetLastError=true)] public static extern bool OpenProcessToken(IntPtr h, int acc, out IntPtr tok);
  [DllImport("advapi32.dll", SetLastError=true)] public static extern bool LookupPrivilegeValue(string host, string name, ref long luid);
  [DllImport("advapi32.dll", SetLastError=true)] public static extern bool AdjustTokenPrivileges(IntPtr tok, bool all, ref TP nw, int len, IntPtr prev, IntPtr rel);
  [DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
  public static string Set(string name, bool enable) {
    IntPtr tok; if (!OpenProcessToken(GetCurrentProcess(), 0x28, out tok)) return "open " + Marshal.GetLastWin32Error();
    TP tp = new TP(); tp.Count = 1; tp.Attr = enable ? 2 : 0;
    if (!LookupPrivilegeValue(null, name, ref tp.Luid)) return "lookup " + Marshal.GetLastWin32Error();
    bool ok = AdjustTokenPrivileges(tok, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
    return name + (enable ? " enabled " : " disabled ") + ok + " err=" + Marshal.GetLastWin32Error();
  }
}
"@
[Tok]::Set('SeBackupPrivilege', $false) | Out-Null
"PRIV: " + ((& "$env:WINDIR\System32\whoami.exe" /priv | Select-String -Pattern 'SeBackupPrivilege').ToString() -replace '\s+', ' ')
& node $Script $Wt $Out 2>&1 | ForEach-Object { "$_" }
"EXIT: $LASTEXITCODE"
