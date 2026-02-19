#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/bin:$PATH"

list_online_emulators() {
  adb devices | tr -d '\r' | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" { print $1 }'
}

list_unhealthy_emulators() {
  adb devices | tr -d '\r' | awk '$1 ~ /^emulator-[0-9]+$/ && ($2 == "offline" || $2 == "unauthorized") { print $1 }'
}

purge_unhealthy_emulators() {
  local unhealthy_serials="$1"
  if [[ -z "$unhealthy_serials" ]]; then
    return 0
  fi

  while IFS= read -r serial; do
    [[ -z "$serial" ]] && continue
    local port="${serial#emulator-}"
    adb disconnect "$serial" >/dev/null 2>&1 || true
    adb disconnect "127.0.0.1:$port" >/dev/null 2>&1 || true
    adb -s "$serial" emu kill >/dev/null 2>&1 || true
  done <<< "$unhealthy_serials"
}

wait_for_emulator_ready() {
  local serial="$1"
  adb -s "$serial" wait-for-device >/dev/null 2>&1 || return 1

  for _ in $(seq 1 180); do
    local state
    local boot_completed
    state="$(adb -s "$serial" get-state 2>/dev/null | tr -d '\r' || true)"
    boot_completed="$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)"
    if [[ "$state" == "device" && "$boot_completed" == "1" ]]; then
      return 0
    fi
    sleep 2
  done

  return 1
}

ensure_adb_reverse() {
  local serial="$1"
  local ports=(8081 19000 19001)
  for port in "${ports[@]}"; do
    adb -s "$serial" reverse "tcp:$port" "tcp:$port" >/dev/null 2>&1 || true
  done
}

kill_stale_windows_emulators() {
  powershell.exe -NoProfile -Command \
    "Get-Process -Name emulator,qemu-system-x86_64,qemu-system-x86_64-headless -ErrorAction SilentlyContinue | Stop-Process -Force" \
    >/dev/null 2>&1 || true
}

restart_adb_server() {
  adb kill-server >/dev/null 2>&1 || true
  for _ in $(seq 1 5); do
    if adb start-server >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  adb start-server
}

hydrate_sdk_proxy() {
  local proxy_root="$1"
  local real_root="$2"
  mkdir -p "$proxy_root"

  local link_dirs=(
    "licenses"
    "build-tools"
    "platforms"
    "ndk"
    "cmake"
    "patcher"
    "sources"
    "system-images"
  )

  for dir_name in "${link_dirs[@]}"; do
    if [[ -d "$real_root/$dir_name" ]]; then
      ln -sfn "$real_root/$dir_name" "$proxy_root/$dir_name"
    fi
  done
}

ANDROID_SDK_ROOT_WIN="$(powershell.exe -NoProfile -Command "if (\$env:ANDROID_SDK_ROOT) { Write-Output \$env:ANDROID_SDK_ROOT } else { Join-Path \$env:LOCALAPPDATA 'Android\\Sdk' }" | tr -d '\r')"
ANDROID_SDK_ROOT_WSL_REAL="$(wslpath "$ANDROID_SDK_ROOT_WIN")"
ANDROID_SDK_PROXY_ROOT="$SCRIPT_DIR/sdk-proxy"
hydrate_sdk_proxy "$ANDROID_SDK_PROXY_ROOT" "$ANDROID_SDK_ROOT_WSL_REAL"
export ANDROID_SDK_ROOT="$ANDROID_SDK_PROXY_ROOT"
export ANDROID_HOME="$ANDROID_SDK_PROXY_ROOT"
export ANDROID_SDK_ROOT_REAL="$ANDROID_SDK_ROOT_WSL_REAL"
export ANDROID_HOME_REAL="$ANDROID_SDK_ROOT_WSL_REAL"
export ANDROID_SDK_ROOT_WIN="$ANDROID_SDK_ROOT_WIN"

# Gradle build must use Linux Android SDK tools (aapt, etc.), not Windows .exe binaries.
ANDROID_BUILD_SDK_ROOT="${ANDROID_BUILD_SDK_ROOT:-$HOME/Android/Sdk}"
if [[ ! -x "$ANDROID_BUILD_SDK_ROOT/build-tools/36.0.0/aapt" ]]; then
  echo "Missing Linux build-tools aapt at: $ANDROID_BUILD_SDK_ROOT/build-tools/36.0.0/aapt"
  echo "Install with:"
  echo "  sdkmanager \"platform-tools\" \"platforms;android-36\" \"build-tools;36.0.0\" \"ndk;27.1.12297006\""
  exit 1
fi
if ! command -v javac >/dev/null 2>&1; then
  echo "Missing javac (JDK compiler). Install: sudo dnf -y install java-21-openjdk-devel"
  exit 1
fi
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export ORG_GRADLE_JAVA_HOME="$JAVA_HOME"
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.java.home=$JAVA_HOME"

AVD_NAME="${1:-}"
SERIAL="$(list_online_emulators | head -n1 || true)"
UNHEALTHY="$(list_unhealthy_emulators || true)"

if [[ -n "$UNHEALTHY" ]]; then
  echo "Found unhealthy emulator(s), resetting adb/emulator state:"
  echo "$UNHEALTHY" | sed 's/^/  - /'
  purge_unhealthy_emulators "$UNHEALTHY"
  kill_stale_windows_emulators
  restart_adb_server
  purge_unhealthy_emulators "$(list_unhealthy_emulators || true)"
  SERIAL="$(list_online_emulators | head -n1 || true)"
fi

if [[ -z "$SERIAL" ]]; then
  if [[ -z "$AVD_NAME" ]]; then
    AVD_NAME="$(emulator -list-avds | tr -d '\r' | head -n1)"
  fi

  if [[ -z "$AVD_NAME" ]]; then
    echo "No Android Virtual Device found. Create one in Android Studio (Windows) first."
    exit 1
  fi

  echo "Starting Windows emulator: $AVD_NAME"
  nohup emulator "@$AVD_NAME" -netdelay none -netspeed full -no-snapshot-load >/tmp/android-emulator.log 2>&1 &

  echo "Waiting for emulator to come online..."
  for _ in $(seq 1 120); do
    SERIAL="$(list_online_emulators | head -n1 || true)"
    if [[ -n "$SERIAL" ]]; then
      break
    fi
    sleep 2
  done

  if [[ -z "$SERIAL" ]]; then
    echo "Emulator did not come online in time. Check /tmp/android-emulator.log."
    exit 1
  fi
fi

echo "Waiting for emulator boot completion: $SERIAL"
if ! wait_for_emulator_ready "$SERIAL"; then
  echo "Emulator is online but did not complete boot in time."
  exit 1
fi

export ANDROID_SERIAL="$SERIAL"
ensure_adb_reverse "$SERIAL"

APP_ID="$(node -e "const app=require('./app.json'); process.stdout.write(app?.expo?.android?.package ?? '');")"
if [[ -z "$APP_ID" ]]; then
  echo "Missing expo.android.package in app.json."
  exit 1
fi

echo "Building and installing development client for $APP_ID on $SERIAL..."
# Ensure native project resolves Linux SDK during Gradle build.
mkdir -p android
cat > android/local.properties <<EOF
sdk.dir=$ANDROID_BUILD_SDK_ROOT
EOF
# Ensure old daemons started before JDK install do not keep stale capability detection.
(cd android && ./gradlew --stop >/dev/null 2>&1 || true)
# Build directly with Gradle to avoid Expo CLI device reconciliation touching stale emulator IDs.
(cd android && \
  JAVA_HOME="$JAVA_HOME" ORG_GRADLE_JAVA_HOME="$ORG_GRADLE_JAVA_HOME" \
  ./gradlew app:assembleDebug -x lint -x test --configure-on-demand --build-cache \
    -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=x86_64,arm64-v8a)

APK_PATH="$(find android/app/build/outputs/apk -type f -name '*.apk' | sort | grep -E 'debug|Debug' | tail -n1 || true)"
if [[ -z "$APK_PATH" ]]; then
  echo "Could not find debug APK after build."
  exit 1
fi

echo "Installing APK on $SERIAL: $APK_PATH"
adb -s "$SERIAL" install -r "$APK_PATH"

echo "Launching app: $APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "Development client installed and launched."
