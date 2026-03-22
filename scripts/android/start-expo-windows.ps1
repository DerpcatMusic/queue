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

function Get-JavaHome {
  $androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"

  if ($env:JAVA_HOME -and (Test-Path $env:JAVA_HOME)) {
    $javaExe = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path $javaExe) {
      $javaVersionOutput = cmd /c "`"$javaExe`" -version 2>&1"
      $javaVersionText = ($javaVersionOutput | Select-Object -First 1)
      if ($javaVersionText -match '"(\d+)(?:\.(\d+))?') {
        $javaMajor = [int]$Matches[1]
        if ($javaMajor -ge 17 -and $javaMajor -le 21) {
          return $env:JAVA_HOME
        }
      }
    }
    Write-Warning "JAVA_HOME points to an unsupported JDK for Android builds. Falling back to Android Studio JBR (JDK 21)."
  }

  if (Test-Path $androidStudioJbr) {
    return $androidStudioJbr
  }

  return $null
}

function Ensure-AndroidProject {
  param([string]$ProjectRoot)

  if (Test-Path (Join-Path $ProjectRoot "android")) {
    return
  }

  Write-Host "Android project not found. Generating native Android project via Expo prebuild..."
  if (Get-Command bunx -ErrorAction SilentlyContinue) {
    & bunx expo prebuild --platform android --non-interactive
  } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx expo prebuild --platform android --non-interactive
  } else {
    throw "Neither bunx nor npx is available. Install Bun (preferred) or Node.js."
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Expo prebuild failed with exit code $LASTEXITCODE"
  }
}

function Install-DebugApk {
  param(
    [string]$AdbExe,
    [string]$TargetSerial,
    [string]$ApkPath,
    [string]$AppId
  )

  if (-not (Test-Path $ApkPath)) {
    throw "Debug APK not found at: $ApkPath"
  }

  if ($AppId) {
    & $AdbExe -s $TargetSerial uninstall $AppId | Out-Null
  }

  & $AdbExe -s $TargetSerial install -r $ApkPath
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Warning "Direct adb install failed, retrying with push + pm install fallback."
  $remoteApk = "/data/local/tmp/app-debug.apk"
  & $AdbExe -s $TargetSerial push $ApkPath $remoteApk | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "adb push failed with exit code $LASTEXITCODE"
  }
  & $AdbExe -s $TargetSerial shell pm install -r $remoteApk
  if ($LASTEXITCODE -ne 0) {
    throw "pm install fallback failed with exit code $LASTEXITCODE"
  }
}

function Start-ExpoDevServer {
  param([int]$MetroPort)

  if (Get-Command bunx -ErrorAction SilentlyContinue) {
    & bunx expo start --dev-client --port $MetroPort
    return
  }
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx expo start --dev-client --port $MetroPort
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
  $javaHome = Get-JavaHome

  if (-not (Test-Path $adbExe)) {
    throw "adb.exe not found at: $adbExe"
  }
  if (-not (Test-Path $emulatorExe)) {
    throw "emulator.exe not found at: $emulatorExe"
  }
  if (-not $javaHome) {
    throw "JAVA_HOME is not set and Android Studio JBR was not found. Set JAVA_HOME to JDK 21."
  }

  $env:JAVA_HOME = $javaHome
  $env:Path = "$($env:JAVA_HOME)\bin;$($env:Path)"

  Ensure-AndroidProject -ProjectRoot $projectRoot
  $androidProjectDir = Join-Path $projectRoot "android"
  "sdk.dir=$sdkRoot" | Set-Content -Path (Join-Path $androidProjectDir "local.properties")

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
  $metroPort = 8081

  $appJson = Get-Content -Raw ".\app.json" | ConvertFrom-Json
  $appId = $appJson.expo.android.package
  Push-Location $androidProjectDir
  try {
    if (-not (Test-Path ".\gradlew.bat")) {
      throw "gradlew.bat not found under android/. Run prebuild first."
    }
    $env:NODE_ENV = "development"
    & .\gradlew.bat :app:assembleDebug
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle assembleDebug failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  if ($appId) {
    $apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
    Install-DebugApk -AdbExe $adbExe -TargetSerial $serial -ApkPath $apkPath -AppId $appId

    Start-Job -ScriptBlock {
      param($AdbExe, $Serial, $AppId, $MetroPort)
      $devUrls = @(
        "queue://expo-development-client/?url=http://127.0.0.1:$MetroPort",
        "exp+queue://expo-development-client/?url=http://127.0.0.1:$MetroPort"
      )

      for ($i = 0; $i -lt 180; $i++) {
        try {
          $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$MetroPort" -TimeoutSec 2
          if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            for ($attempt = 0; $attempt -lt 30; $attempt++) {
              & $AdbExe -s $Serial shell monkey -p $AppId -c android.intent.category.LAUNCHER 1 | Out-Null
              foreach ($devUrl in $devUrls) {
                & $AdbExe -s $Serial shell am start -a android.intent.action.VIEW -d $devUrl | Out-Null
              }
              Start-Sleep -Seconds 2
            }
            return
          }
        } catch {
        }

        Start-Sleep -Seconds 1
      }
    } -ArgumentList $adbExe, $serial, $appId, $metroPort | Out-Null
  }

  Start-ExpoDevServer -MetroPort $metroPort
} finally {
  Pop-Location
}
