$ErrorActionPreference = "Stop"

function Check($ok, $message) {
  if ($ok) {
    Write-Host "[OK] $message"
  } else {
    Write-Host "[FAIL] $message"
    $script:failed = $true
  }
}

$script:failed = $false

$sdkRoot = if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
  $env:ANDROID_SDK_ROOT
} else {
  Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

$adbExe = Join-Path $sdkRoot "platform-tools\adb.exe"
$emulatorExe = Join-Path $sdkRoot "emulator\emulator.exe"

Check (Test-Path $adbExe) "adb.exe exists at $adbExe"
Check (Test-Path $emulatorExe) "emulator.exe exists at $emulatorExe"
Check (Get-Command bun -ErrorAction SilentlyContinue) "bun is installed"
Check (Get-Command bunx -ErrorAction SilentlyContinue) "bunx is installed"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$appJsonPath = Join-Path $projectRoot "app.json"
$packageJsonPath = Join-Path $projectRoot "package.json"

$appJson = Get-Content -Raw -Path $appJsonPath | ConvertFrom-Json
$packageJson = Get-Content -Raw -Path $packageJsonPath | ConvertFrom-Json

$androidPackage = $appJson.expo.android.package
$expectedVersion = $appJson.expo.version
$expoLocationVersion = $packageJson.dependencies."expo-location"

Check ($null -ne $androidPackage -and $androidPackage.Length -gt 0) "Android package id detected: $androidPackage"
Check ($null -ne $expectedVersion -and $expectedVersion.Length -gt 0) "Expo app version detected: $expectedVersion"
Check ($null -ne $expoLocationVersion -and $expoLocationVersion.Length -gt 0) "expo-location dependency found in package.json ($expoLocationVersion)"

if (Test-Path $adbExe) {
  & $adbExe start-server | Out-Null
  $deviceLines = & $adbExe devices | Where-Object { $_ -match "^\S+\s+device$" }
  Write-Host ""
  Write-Host "adb devices:"
  & $adbExe devices
  Write-Host ""

  if ($deviceLines.Count -eq 0) {
    Write-Host "[WARN] No connected Android device/emulator detected."
  } else {
    foreach ($line in $deviceLines) {
      $deviceId = ($line -split "\s+")[0]
      if (-not $deviceId) {
        continue
      }

      $packageLine = & $adbExe -s $deviceId shell pm list packages $androidPackage
      $isInstalled = $packageLine -match "package:$androidPackage"
      Check $isInstalled "[$deviceId] app package installed ($androidPackage)"

      if (-not $isInstalled) {
        continue
      }

      $packageDump = & $adbExe -s $deviceId shell dumpsys package $androidPackage
      $versionLine = ($packageDump | Select-String -Pattern "versionName=" | Select-Object -First 1)
      $installedVersion = ""
      if ($versionLine) {
        $installedVersion = ($versionLine.ToString() -replace ".*versionName=", "").Trim()
      }

      if ($installedVersion.Length -gt 0) {
        $versionMatches = $installedVersion -eq $expectedVersion
        Check $versionMatches "[$deviceId] installed app version ($installedVersion) matches app.json ($expectedVersion)"

        if (-not $versionMatches) {
          Write-Host "[INFO] [$deviceId] Rebuild recommended: bunx expo run:android"
        }
      } else {
        Write-Host "[WARN] [$deviceId] Could not read installed versionName from dumpsys output."
      }
    }
  }
}

if ($failed) {
  Write-Host ""
  Write-Host "Remediation:"
  Write-Host "1) Rebuild the native app: bunx expo run:android"
  Write-Host "2) Start Metro for dev client: bun run android"
  exit 1
}
