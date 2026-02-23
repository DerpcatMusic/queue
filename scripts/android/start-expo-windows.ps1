param(
  [string]$AvdName
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Get-SdkRoot {
  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
    return $env:ANDROID_SDK_ROOT
  }
  return (Join-Path $env:LOCALAPPDATA "Android\Sdk")
}

function Get-OnlineEmulatorSerial {
  param([string]$AdbExe)
  $lines = & $AdbExe devices | ForEach-Object { $_.Trim() }
  foreach ($line in $lines) {
    if ($line -match "^(emulator-\d+)\s+device$") {
      return $Matches[1]
    }
  }
  return $null
}

function Has-NonDeviceEmulators {
  param([string]$AdbExe)
  $lines = & $AdbExe devices | ForEach-Object { $_.Trim() }
  foreach ($line in $lines) {
    if ($line -match "^emulator-\d+\s+(.+)$" -and $Matches[1] -ne "device") {
      return $true
    }
  }
  return $false
}

function Remove-StaleEmulatorTransports {
  param([string]$AdbExe)
  $lines = & $AdbExe devices | ForEach-Object { $_.Trim() }
  foreach ($line in $lines) {
    if ($line -match "^(emulator-(\d+))\s+(.+)$") {
      $serial = $Matches[1]
      $port = $Matches[2]
      $state = $Matches[3]
      if ($state -ne "device") {
        cmd /c "`"$AdbExe`" disconnect $serial >nul 2>nul" | Out-Null
        cmd /c "`"$AdbExe`" disconnect 127.0.0.1:$port >nul 2>nul" | Out-Null
      }
    }
  }
}

function Wait-ForBoot {
  param([string]$AdbExe, [string]$Serial)
  & $AdbExe -s $Serial wait-for-device | Out-Null
  for ($i = 0; $i -lt 180; $i++) {
    $state = (& $AdbExe -s $Serial get-state 2>$null | Out-String).Trim()
    $boot = (& $AdbExe -s $Serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    if ($state -eq "device" -and $boot -eq "1") {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "Emulator boot did not complete in time for $Serial."
}

function Ensure-Reverse {
  param([string]$AdbExe, [string]$Serial)
  foreach ($port in @(8081, 19000, 19001)) {
    try {
      & $AdbExe -s $Serial reverse ("tcp:{0}" -f $port) ("tcp:{0}" -f $port) | Out-Null
    } catch {
      Write-Warning "Failed to adb reverse tcp:$port on $Serial"
    }
  }
}

function Start-ExpoDevServer {
  if (Get-Command bunx -ErrorAction SilentlyContinue) {
    & bunx expo start
    return
  }
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx expo start
    return
  }
  throw "Neither bunx nor npx is available. Install Bun (preferred) or Node.js."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")
Push-Location $projectRoot
try {
  $sdkRoot = Get-SdkRoot
  $adbExe = Join-Path $sdkRoot "platform-tools\adb.exe"
  $emulatorExe = Join-Path $sdkRoot "emulator\emulator.exe"

  if (-not (Test-Path $adbExe)) {
    throw "adb.exe not found at: $adbExe"
  }
  if (-not (Test-Path $emulatorExe)) {
    throw "emulator.exe not found at: $emulatorExe"
  }

  & $adbExe start-server | Out-Null
  Remove-StaleEmulatorTransports -AdbExe $adbExe
  if (Has-NonDeviceEmulators -AdbExe $adbExe) {
    & $adbExe kill-server | Out-Null
    & $adbExe start-server | Out-Null
    Remove-StaleEmulatorTransports -AdbExe $adbExe
  }

  $serial = Get-OnlineEmulatorSerial -AdbExe $adbExe
  if (-not $serial) {
    if (-not $AvdName) {
      $AvdName = (& $emulatorExe -list-avds | Select-Object -First 1).Trim()
    }
    if (-not $AvdName) {
      throw "No Android Virtual Device found. Create one in Android Studio first."
    }

    Write-Host "Starting emulator: $AvdName"
    Start-Process -FilePath $emulatorExe -ArgumentList "@$AvdName", "-netdelay", "none", "-netspeed", "full", "-no-snapshot-load" | Out-Null

    for ($i = 0; $i -lt 120; $i++) {
      Start-Sleep -Seconds 2
      Remove-StaleEmulatorTransports -AdbExe $adbExe
      $serial = Get-OnlineEmulatorSerial -AdbExe $adbExe
      if ($serial) {
        break
      }
    }
    if (-not $serial) {
      throw "Emulator did not come online in time."
    }
  }

  Write-Host "Waiting for emulator boot completion: $serial"
  Wait-ForBoot -AdbExe $adbExe -Serial $serial

  $env:ANDROID_SERIAL = $serial
  Ensure-Reverse -AdbExe $adbExe -Serial $serial

  $appJson = Get-Content -Raw ".\app.json" | ConvertFrom-Json
  $appId = $appJson.expo.android.package
  if ($appId) {
    & $adbExe -s $serial shell monkey -p $appId -c android.intent.category.LAUNCHER 1 | Out-Null
  }

  # Use dev-client mode without Expo auto device probing (avoids stale 127.0.0.1:<port> failures).
  Start-ExpoDevServer
} finally {
  Pop-Location
}
