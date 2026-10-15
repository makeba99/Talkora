$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TeamsPilotCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct Credential {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWrite(ref Credential userCredential, uint flags);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credential);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredDelete(string target, uint type, uint flags);

  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
}
"@

function Fail([string]$message) {
  @{ ok = $false; error = $message } | ConvertTo-Json -Compress
  exit 0
}

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { Fail "Missing request." }
$request = $raw | ConvertFrom-Json
$name = [string]$request.name
if ($name -notmatch '^[a-z0-9-]{1,40}$') { Fail "Invalid secret name." }
$target = "TeamsPilot:$name"
$op = [string]$request.op

if ($op -eq "get") {
  $ptr = [IntPtr]::Zero
  $ok = [TeamsPilotCred]::CredRead($target, 1, 0, [ref]$ptr)
  if (-not $ok) {
    @{ ok = $true; value = $null } | ConvertTo-Json -Compress
    exit 0
  }
  try {
    $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][TeamsPilotCred+Credential])
    $count = [int]$cred.CredentialBlobSize
    $bytes = New-Object byte[] $count
    [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $count)
    $text = [Text.Encoding]::Unicode.GetString($bytes)
    @{ ok = $true; value = $text } | ConvertTo-Json -Compress
  } finally {
    [TeamsPilotCred]::CredFree($ptr)
  }
  exit 0
}

if ($op -eq "delete") {
  [void][TeamsPilotCred]::CredDelete($target, 1, 0)
  @{ ok = $true } | ConvertTo-Json -Compress
  exit 0
}

if ($op -eq "set") {
  $value = [string]$request.value
  $bytes = [Text.Encoding]::Unicode.GetBytes($value)
  if ($bytes.Length -gt 2560) { Fail "Value is too large for Credential Manager." }
  $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
    $cred = New-Object TeamsPilotCred+Credential
    $cred.Type = 1
    $cred.TargetName = $target
    $cred.CredentialBlobSize = [uint32]$bytes.Length
    $cred.CredentialBlob = $blob
    $cred.Persist = 2
    $cred.UserName = "TeamsPilot"
    $written = [TeamsPilotCred]::CredWrite([ref]$cred, 0)
    if (-not $written) { Fail "Credential Manager rejected the secret." }
    @{ ok = $true } | ConvertTo-Json -Compress
  } finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
  }
  exit 0
}

if ($op -eq "protect") {
  $value = [string]$request.value
  $bytes = [Text.Encoding]::UTF8.GetBytes($value)
  $entropy = [Text.Encoding]::UTF8.GetBytes("TeamsPilot")
  $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, "CurrentUser")
  @{ ok = $true; value = [Convert]::ToBase64String($protected) } | ConvertTo-Json -Compress
  exit 0
}

if ($op -eq "unprotect") {
  $cipher = [string]$request.value
  $entropy = [Text.Encoding]::UTF8.GetBytes("TeamsPilot")
  $bytes = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($cipher), $entropy, "CurrentUser")
  @{ ok = $true; value = [Text.Encoding]::UTF8.GetString($bytes) } | ConvertTo-Json -Compress
  exit 0
}

Fail "Unknown operation."
