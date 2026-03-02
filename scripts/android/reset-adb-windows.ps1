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

function Get-AdbExe {
  $sdkRoot = Get-SdkRoot
  $adbExe = Join-Path $sdkRoot "platform-tools\adb.exe"
  if (-not (Test-Path $adbExe)) {
    throw "adb.exe not found at: $adbExe"
  }
  return $adbExe
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

$adbExe = Get-AdbExe

Write-Host "Resetting ADB server..."
& $adbExe kill-server | Out-Null
& $adbExe start-server | Out-Null

Write-Host "Dropping stale emulator transports..."
Remove-StaleEmulatorTransports -AdbExe $adbExe

Write-Host "Reconnecting offline devices..."
try {
  & $adbExe reconnect offline | Out-Null
} catch {
  Write-Warning "adb reconnect offline failed, continuing."
}

Write-Host ""
Write-Host "ADB devices after reset:"
& $adbExe devices -l

Write-Host ""
Write-Host "Tip: for physical phone development run 'bun run android:phone'."
