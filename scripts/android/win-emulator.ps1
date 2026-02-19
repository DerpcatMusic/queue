param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$EmulatorArgs
)

$sdkRoot = if ($env:ANDROID_SDK_ROOT_WIN -and (Test-Path $env:ANDROID_SDK_ROOT_WIN)) {
  $env:ANDROID_SDK_ROOT_WIN
} elseif ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
  $env:ANDROID_SDK_ROOT
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

$emulatorExe = Join-Path $sdkRoot 'emulator\emulator.exe'
if (-not (Test-Path $emulatorExe)) {
  Write-Error "emulator.exe not found at: $emulatorExe"
  exit 1
}

& $emulatorExe @EmulatorArgs
exit $LASTEXITCODE
