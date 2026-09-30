# machine-lease.ps1: ONE compute lease per machine (T-204). A developer's test suite and qa-queue.ps1 each take it
# before a run, so neither starts over the other. Machine-agnostic: no host names, every machine runs this same copy.
#
# Verbs:   take | release | renew | status
# Usage:   powershell -NoProfile -ExecutionPolicy Bypass -File machine-lease.ps1 take -OwnerPid <pid> -Seat forge -TtlMinutes 90
#
# The copy lives in %USERPROFILE%, next to qa-queue.ps1, and is never run from inside a checkout.
#
# The lease file is %USERPROFILE%\machine-lease\lease.json: outside every repo, one fixed place per machine.
# It is PER USER on purpose: on each machine SIA QA and the developer seats run under one profile. The limit is that
# two different Windows users on one machine would not see each other's lease. `status` prints that limit.
#
# OWNER PID. This process is short-lived, so its own pid is never recorded. -OwnerPid is a LONG-LIVED process that
# stands for the work (the queue passes its own $PID; a developer passes their session or shell pid; a detached
# launcher passes the pid of the job it created). The lease is reclaimed when that process is gone.
#
# TAKE IS ATOMIC. The whole lease is written to a temp file in the same folder, then moved onto lease.json with
# File.Move, which fails when the target exists. Exactly one taker wins, and a reader never sees a half-written file.
# Reclaiming a stale lease is serialised by a named mutex and re-verified under it, so a second reclaimer cannot
# remove the lease the first one just took.
#
# STALE = expired, OR the owner pid is gone, OR the pid exists with a different creation time (PID reuse).
# A pid this process cannot inspect counts as LIVE. An unreadable, empty or malformed lease counts as HELD and is
# never ignored or deleted.
#
# Exit codes: 0 ok / free / released; 10 held by a live owner; 11 held but unreadable or malformed (cause named);
#             12 release or renew by a process that is not the owner; 2 usage.
param(
  [Parameter(Position = 0)] [string] $Verb = '',
  [int] $OwnerPid = 0,
  [string] $Seat = 'unknown',
  [string] $Session = '',
  [int] $TtlMinutes = 60,
  [int] $WaitMinutes = 0,
  [int] $NewOwnerPid = 0    # renew only: hand the lease to this pid (a detached launcher takes as itself, then hands over)
)

$ErrorActionPreference = 'Stop'
$LeaseDir = Join-Path $env:USERPROFILE 'machine-lease'
$LeasePath = Join-Path $LeaseDir 'lease.json'
$Limit = 'per-user lease (%USERPROFILE%\machine-lease): a second Windows user on this machine would not see it'

function Out-Line([string] $k, [string] $v) { Write-Output "$k=$v" }

function Get-StartStamp([int] $procId) {
  try { $proc = Get-Process -Id $procId -ErrorAction Stop } catch { return @{ state = 'gone'; start = $null } }
  try { return @{ state = 'seen'; start = $proc.StartTime.ToUniversalTime().ToString('o') } } catch { return @{ state = 'unknown'; start = $null } }
}

# Returns @{ ok; lease; cause }. Anything that is not a complete lease is ok=$false with a named cause.
function Read-Lease([string] $path) {
  $text = $null
  try {
    $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
    try { $text = (New-Object System.IO.StreamReader($fs)).ReadToEnd() } finally { $fs.Dispose() }
  } catch { return @{ ok = $false; lease = $null; cause = "unreadable ($($_.Exception.Message))"; text = $null } }
  if ([string]::IsNullOrWhiteSpace($text)) { return @{ ok = $false; lease = $null; cause = 'empty'; text = $text } }
  try { $l = $text | ConvertFrom-Json } catch { return @{ ok = $false; lease = $null; cause = 'malformed json'; text = $text } }
  foreach ($f in 'owner_seat', 'session', 'pid', 'pid_start', 'started', 'expires') {
    if ($null -eq $l -or $null -eq $l.PSObject.Properties[$f]) { return @{ ok = $false; lease = $null; cause = "missing field $f"; text = $text } }
  }
  $ownerId = 0
  if (-not [int]::TryParse([string]$l.pid, [ref]$ownerId) -or $ownerId -le 0) { return @{ ok = $false; lease = $null; cause = 'bad pid'; text = $text } }
  $exp = [datetime]::MinValue
  if (-not [datetime]::TryParse([string]$l.expires, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$exp)) {
    return @{ ok = $false; lease = $null; cause = 'bad expires'; text = $text }
  }
  return @{ ok = $true; lease = $l; cause = $null; text = $text; expires = $exp.ToUniversalTime(); ownerPid = $ownerId }
}

# live = do not take this lease.
function Test-Lease($r) {
  if ((Get-Date).ToUniversalTime() -ge $r.expires) { return @{ live = $false; reason = 'expired' } }
  $stamp = Get-StartStamp $r.ownerPid
  if ($stamp.state -eq 'gone') { return @{ live = $false; reason = 'pid_gone' } }
  if ($stamp.state -ne 'seen') { return @{ live = $true; reason = 'start_unreadable' } }
  
  return @{ live = $true; reason = 'held' }
}

function Describe($r) { "owner=$($r.lease.owner_seat) session=$($r.lease.session) pid=$($r.ownerPid) started=$($r.lease.started) expires=$($r.lease.expires)" }

function New-LeaseJson([int] $ownerId, [string] $ownerStart, [string] $started) {
  $now = (Get-Date).ToUniversalTime()
  if (-not $started) { $started = $now.ToString('o') }
  return ([pscustomobject][ordered]@{
    owner_seat = $Seat; session = $Session; pid = $ownerId; pid_start = $ownerStart
    started = $started; expires = $now.AddMinutes($TtlMinutes).ToString('o')
  } | ConvertTo-Json -Compress)
}

function Try-Move([string] $tmp) {
  try { [System.IO.File]::Move($tmp, $LeasePath); return $true }
  catch [System.IO.IOException] { return $false }
}

# Serialises only the removal of a STALE lease, never the take itself: the atomic Move stays the one thing that
# decides the winner. Under the mutex the lease is read again and removed only if it is still the same stale one.
function Reclaim-Stale([string] $staleText, [string] $reason) {
  $mutex = New-Object System.Threading.Mutex($false, 'Global\sia-machine-lease-reclaim')
  $got = $false
  try {
    try { $got = $mutex.WaitOne(30000) } catch [System.Threading.AbandonedMutexException] { $got = $true }
    if (-not $got) { return $false }
    if (-not (Test-Path -LiteralPath $LeasePath)) { return $true }
    $again = Read-Lease $LeasePath
    if ($again.text -ne $staleText) { return $true }   # someone else already replaced it: retry the take
    Remove-Item -LiteralPath $LeasePath -Force
    $script:Takeover = "stale lease reason=$reason"   # printed by the caller: output here would join the return value
    return $true
  } finally { if ($got) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
}

function Verb-Status {
  Out-Line 'limit' $Limit
  Out-Line 'path' $LeasePath
  if (-not (Test-Path -LiteralPath $LeasePath)) { Out-Line 'lease' 'free'; exit 0 }
  $r = Read-Lease $LeasePath
  if (-not $r.ok) { Out-Line 'lease' "held (unreadable or malformed: $($r.cause))"; exit 11 }
  $t = Test-Lease $r
  if ($t.live) { Out-Line 'lease' "held $(Describe $r)"; exit 10 }
  Out-Line 'lease' "free (stale: $($t.reason)) $(Describe $r)"
  exit 0
}

function Verb-Take {
  if ($OwnerPid -le 0) { Out-Line 'usage' 'take needs -OwnerPid <a long-lived pid>'; exit 2 }
  $stamp = Get-StartStamp $OwnerPid
  if ($stamp.state -ne 'seen') { Out-Line 'usage' "owner pid $OwnerPid is not a running process we can read ($($stamp.state))"; exit 2 }
  New-Item -ItemType Directory -Force $LeaseDir | Out-Null
  $deadline = (Get-Date).AddMinutes($WaitMinutes)
  $announced = $false
  while ($true) {
    $tmp = Join-Path $LeaseDir ("lease.$([guid]::NewGuid().ToString('N')).tmp")
    [System.IO.File]::WriteAllText($tmp, (New-LeaseJson $OwnerPid $stamp.start $null))
    if (Try-Move $tmp) { Out-Line 'lease' "taken owner=$Seat pid=$OwnerPid"; exit 0 }
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    $r = Read-Lease $LeasePath
    if (-not $r.ok) {
      if ($r.cause -like 'unreadable*' -and -not (Test-Path -LiteralPath $LeasePath)) { continue }   # vanished between move and read
      Out-Line 'lease' "held, unreadable or malformed: $($r.cause)"; exit 11
    }
    $t = Test-Lease $r
    if ($t.live) {
      if ((Get-Date) -ge $deadline) { Out-Line 'busy' (Describe $r); exit 10 }
      if (-not $announced) { Out-Line 'wait' "busy: $(Describe $r)"; $announced = $true }
      Start-Sleep -Seconds ([math]::Min(15, [math]::Max(1, $WaitMinutes)))
      continue
    }
    $script:Takeover = $null
    $reclaimed = Reclaim-Stale $r.text $t.reason
    if ($script:Takeover) { Out-Line 'takeover' $script:Takeover }
    if (-not $reclaimed) { Out-Line 'lease' 'held, reclaim gate busy'; exit 10 }
  }
}

function Assert-Owner {
  if ($OwnerPid -le 0) { Out-Line 'usage' "$Verb needs -OwnerPid"; exit 2 }
  if (-not (Test-Path -LiteralPath $LeasePath)) { Out-Line 'lease' 'free'; exit 0 }
  $r = Read-Lease $LeasePath
  if (-not $r.ok) { Out-Line 'lease' "held, unreadable or malformed: $($r.cause); not touched"; exit 11 }
  $stamp = Get-StartStamp $OwnerPid
  # Ours only when the pid AND its creation time match the record; a caller we cannot read is not the owner.
  if ($r.ownerPid -ne $OwnerPid -or $stamp.state -ne 'seen' -or [string]$r.lease.pid_start -ne [string]$stamp.start) {
    Out-Line 'lease' "not yours ($(Describe $r)); nothing changed"; exit 12
  }
  return $r
}

function Verb-Release {
  $r = Assert-Owner
  Remove-Item -LiteralPath $LeasePath -Force
  Out-Line 'lease' 'released'
  exit 0
}

function Verb-Renew {
  $r = Assert-Owner
  $newId = $OwnerPid
  $newStart = [string]$r.lease.pid_start
  if ($NewOwnerPid -gt 0) {
    $ns = Get-StartStamp $NewOwnerPid
    if ($ns.state -ne 'seen') { Out-Line 'usage' "new owner pid $NewOwnerPid is not a running process we can read ($($ns.state))"; exit 2 }
    $newId = $NewOwnerPid; $newStart = $ns.start
  }
  $tmp = Join-Path $LeaseDir ("lease.$([guid]::NewGuid().ToString('N')).tmp")
  [System.IO.File]::WriteAllText($tmp, (New-LeaseJson $newId $newStart ([string]$r.lease.started)))
  # PowerShell turns a $null string argument into '' (an illegal path), so Replace gets a real backup name.
  $bak = "$tmp.bak"
  [System.IO.File]::Replace($tmp, $LeasePath, $bak)
  Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue
  Out-Line 'lease' "renewed ttl_min=$TtlMinutes owner_pid=$newId"
  exit 0
}

switch ($Verb) {
  'take'    { Verb-Take }
  'release' { Verb-Release }
  'renew'   { Verb-Renew }
  'status'  { Verb-Status }
  default   { Out-Line 'usage' 'machine-lease.ps1 take|release|renew|status [-OwnerPid n] [-Seat s] [-Session s] [-TtlMinutes n] [-WaitMinutes n]'; exit 2 }
}
