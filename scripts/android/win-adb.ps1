param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$AdbArgs
)

$sdkRoot = if ($env:ANDROID_SDK_ROOT_WIN -and (Test-Path $env:ANDROID_SDK_ROOT_WIN)) {
  $env:ANDROID_SDK_ROOT_WIN
} elseif ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
  $env:ANDROID_SDK_ROOT
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$adbExe = Join-Path $sdkRoot 'platform-tools\adb.exe'
if (-not (Test-Path $adbExe)) {
  Write-Error "adb.exe not found at: $adbExe"
  exit 1
}

$isEmuNameProbe = $false
if ($AdbArgs.Length -ge 5) {
  $isEmuNameProbe = (
    $AdbArgs[0] -eq '-s' -and
    $AdbArgs[2] -eq 'emu' -and
    $AdbArgs[3] -eq 'avd' -and
    $AdbArgs[4] -eq 'name'
  )
}

& $adbExe @AdbArgs
$exitCode = $LASTEXITCODE

# Expo CLI probes emulator names for every listed transport. Stale offline emulator
# IDs can fail this probe and crash startup even when a healthy emulator is available.
if ($isEmuNameProbe -and $exitCode -ne 0) {
  exit 0
}

exit $exitCode
