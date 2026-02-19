#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/bin:$PATH"

list_online_emulators() {
  adb devices | tr -d '\r' | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" { print $1 }'
}

list_known_emulators() {
  adb devices | tr -d '\r' | awk '$1 ~ /^emulator-[0-9]+$/ { print $1 }'
}

has_online_emulator() {
  list_online_emulators | head -n1 | grep -q '^emulator-[0-9]\+'
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

prune_unreachable_emulators() {
  local serials
  serials="$(list_known_emulators || true)"
  if [[ -z "$serials" ]]; then
    return 0
  fi

  while IFS= read -r serial; do
    [[ -z "$serial" ]] && continue

    if ! adb -s "$serial" get-state >/dev/null 2>&1; then
      local port="${serial#emulator-}"
      adb disconnect "$serial" >/dev/null 2>&1 || true
      adb disconnect "127.0.0.1:$port" >/dev/null 2>&1 || true
      continue
    fi

    # Expo probes emulators with "adb -s <serial> emu avd name". If this fails,
    # the serial is stale and should be dropped before Expo starts.
    if ! adb -s "$serial" emu avd name >/dev/null 2>&1; then
      local port="${serial#emulator-}"
      adb disconnect "$serial" >/dev/null 2>&1 || true
      adb disconnect "127.0.0.1:$port" >/dev/null 2>&1 || true
    fi
  done <<< "$serials"
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
    if ! adb -s "$serial" reverse "tcp:$port" "tcp:$port" >/dev/null 2>&1; then
      echo "Warning: failed adb reverse tcp:$port on $serial"
    fi
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

# Resolve Windows Android SDK and expose as WSL path for wrapper scripts.
ANDROID_SDK_ROOT_WIN="$(powershell.exe -NoProfile -Command "if (\$env:ANDROID_SDK_ROOT) { Write-Output \$env:ANDROID_SDK_ROOT } else { Join-Path \$env:LOCALAPPDATA 'Android\\Sdk' }" | tr -d '\r')"
ANDROID_SDK_ROOT_WSL_REAL="$(wslpath "$ANDROID_SDK_ROOT_WIN")"
ANDROID_SDK_PROXY_ROOT="$SCRIPT_DIR/sdk-proxy"
hydrate_sdk_proxy "$ANDROID_SDK_PROXY_ROOT" "$ANDROID_SDK_ROOT_WSL_REAL"
# Expo CLI resolves adb as $ANDROID_HOME/platform-tools/adb, so point it at our proxy sdk.
export ANDROID_SDK_ROOT="$ANDROID_SDK_PROXY_ROOT"
export ANDROID_HOME="$ANDROID_SDK_PROXY_ROOT"
export ANDROID_SDK_ROOT_REAL="$ANDROID_SDK_ROOT_WSL_REAL"
export ANDROID_HOME_REAL="$ANDROID_SDK_ROOT_WSL_REAL"
export ANDROID_SDK_ROOT_WIN="$ANDROID_SDK_ROOT_WIN"
export EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"
export EXPO_PACKAGER_HOSTNAME="127.0.0.1"

AVD_NAME="${1:-}"
SERIAL="$(list_online_emulators | head -n1 || true)"

UNHEALTHY="$(list_unhealthy_emulators || true)"
if [[ -n "$UNHEALTHY" ]]; then
  echo "Found unhealthy emulator(s), restarting adb server:"
  echo "$UNHEALTHY" | sed 's/^/  - /'
  purge_unhealthy_emulators "$UNHEALTHY"
  echo "Killing stale Windows emulator processes..."
  kill_stale_windows_emulators
  restart_adb_server
  purge_unhealthy_emulators "$(list_unhealthy_emulators || true)"
  SERIAL="$(list_online_emulators | head -n1 || true)"
fi

# Remove phantom emulator entries that can make Expo fail while probing devices.
prune_unreachable_emulators

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
    echo "adb devices output:"
    adb devices | tr -d '\r' || true
    echo "Emulator did not come online in time. Check /tmp/android-emulator.log."
    exit 1
  fi
fi

prune_unreachable_emulators

echo "Waiting for emulator boot completion: $SERIAL"
if ! wait_for_emulator_ready "$SERIAL"; then
  echo "adb devices output:"
  adb devices | tr -d '\r' || true
  echo "Emulator is online but did not complete boot in time."
  exit 1
fi

export ANDROID_SERIAL="$SERIAL"
ensure_adb_reverse "$SERIAL"

echo "Launching Expo for Android..."
exec npx expo start --dev-client --android
