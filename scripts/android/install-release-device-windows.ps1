param(
  [string]$Serial
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

function Get-NodeBinary {
  if ($env:NODE_BINARY -and (Test-Path $env:NODE_BINARY)) {
    return $env:NODE_BINARY
  }

  $nodeExe = "C:\Program Files\nodejs\node.exe"
  if (Test-Path $nodeExe) {
    return $nodeExe
  }

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $nodeFromPath = $null
  if ($nodeCommand) {
    $nodeFromPath = $nodeCommand.Source
  }
  if ($nodeFromPath -and (Test-Path $nodeFromPath) -and ($nodeFromPath -notlike "*\.bun\bin\*")) {
    return $nodeFromPath
  }

  return $null
}

function Get-DeviceSerial {
  param([string]$AdbExe)
  $lines = & $AdbExe devices | ForEach-Object { $_.Trim() }
  foreach ($line in $lines) {
    if ($line -match "^(.*?)\s+device$") {
      $candidate = $Matches[1].Trim()
      if ($candidate -notmatch "^emulator-") {
        return $candidate
      }
    }
  }
  return $null
}

function Remove-StaleEmulatorTransports {
  param([string]$AdbExe)
  $lines = & $AdbExe devices | ForEach-Object { $_.Trim() }
  foreach ($line in $lines) {
    if ($line -match "^(emulator-(\d+))\s+(.+)$") {
      $emulatorSerial = $Matches[1]
      $port = $Matches[2]
      $state = $Matches[3]
      if ($state -ne "device") {
        cmd /c "`"$AdbExe`" disconnect $emulatorSerial >nul 2>nul" | Out-Null
        cmd /c "`"$AdbExe`" disconnect 127.0.0.1:$port >nul 2>nul" | Out-Null
      }
    }
  }
}

function Install-Apk {
  param(
    [string]$AdbExe,
    [string]$TargetSerial,
    [string]$ApkPath
  )

  if (-not (Test-Path $ApkPath)) {
    throw "APK not found at: $ApkPath"
  }

  & $AdbExe -s $TargetSerial install -r $ApkPath
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Write-Warning "Direct adb install failed, retrying with push + pm install fallback."
  $remoteApk = "/data/local/tmp/app-release.apk"
  & $AdbExe -s $TargetSerial push $ApkPath $remoteApk | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "adb push failed with exit code $LASTEXITCODE"
  }
  & $AdbExe -s $TargetSerial shell pm install -r $remoteApk
  if ($LASTEXITCODE -ne 0) {
    throw "pm install fallback failed with exit code $LASTEXITCODE"
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")
Push-Location $projectRoot
try {
  $sdkRoot = Get-SdkRoot
  $adbExe = Join-Path $sdkRoot "platform-tools\adb.exe"
  if (-not (Test-Path $adbExe)) {
    throw "adb.exe not found at: $adbExe"
  }

  $javaHome = Get-JavaHome
  if (-not $javaHome) {
    throw "JAVA_HOME is not set and Android Studio JBR was not found. Set JAVA_HOME to JDK 21."
  }
  $nodeBinary = Get-NodeBinary
  if (-not $nodeBinary) {
    throw "Could not find a real Node.js binary. Install Node.js and ensure NODE_BINARY points to node.exe."
  }
  $env:JAVA_HOME = $javaHome
  $env:NODE_BINARY = $nodeBinary
  $nodeBinDir = Split-Path -Parent $nodeBinary
  $env:Path = "$($env:JAVA_HOME)\bin;$nodeBinDir;$($env:Path)"

  & $adbExe start-server | Out-Null
  Remove-StaleEmulatorTransports -AdbExe $adbExe

  if (-not $Serial) {
    $Serial = Get-DeviceSerial -AdbExe $adbExe
  }
  if (-not $Serial) {
    throw "No physical Android device detected. Connect phone (USB/Wi-Fi adb) and run: adb devices"
  }

  $env:ANDROID_SERIAL = $Serial

  Push-Location (Join-Path $projectRoot "android")
  try {
    if (-not (Test-Path ".\gradlew.bat")) {
      throw "gradlew.bat not found under android/. Run prebuild first."
    }
    $env:NODE_ENV = "production"
    & .\gradlew.bat :app:assembleRelease
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle assembleRelease failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  $apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
  Install-Apk -AdbExe $adbExe -TargetSerial $Serial -ApkPath $apkPath

  $appJson = Get-Content -Raw ".\app.json" | ConvertFrom-Json
  $appId = $appJson.expo.android.package
  if ($appId) {
    & $adbExe -s $Serial shell monkey -p $appId -c android.intent.category.LAUNCHER 1 | Out-Null
  }
} finally {
  Pop-Location
}
