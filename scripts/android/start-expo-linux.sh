#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d /usr/lib/jvm/java-17-openjdk ]]; then
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
    export PATH="$JAVA_HOME/bin:$PATH"
  elif [[ -d /usr/lib/jvm/default ]]; then
    export JAVA_HOME=/usr/lib/jvm/default
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

if [[ ! -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  echo "adb not found at $ANDROID_HOME/platform-tools/adb"
  exit 1
fi
if [[ ! -x "$ANDROID_HOME/emulator/emulator" ]]; then
  echo "emulator not found at $ANDROID_HOME/emulator/emulator"
  exit 1
fi

ensure_android_project() {
  if [[ -d "$PROJECT_ROOT/android" ]]; then
    return 0
  fi
  echo "Android project not found. Generating native Android project via Expo prebuild..."
  npx expo prebuild --platform android --non-interactive
}

# Keep Gradle aligned with this SDK path.
ensure_android_project
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$PROJECT_ROOT/android/local.properties"

adb start-server >/dev/null

get_online_emulator() {
  adb devices | tr -d '\r' | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" { print $1; exit }'
}

SERIAL="$(get_online_emulator || true)"
if [[ -z "$SERIAL" ]]; then
  AVD_NAME="${ANDROID_AVD:-$(emulator -list-avds | head -n1 | tr -d '\r' || true)}"
  if [[ -z "$AVD_NAME" ]]; then
    echo "No AVD found. Create one in Android Studio Device Manager first."
    exit 1
  fi

  echo "Starting emulator: $AVD_NAME"
  QT_PLATFORM_OVERRIDE=()
  if [[ "${QT_QPA_PLATFORM:-}" == "wayland" ]]; then
    # Current emulator bundle doesn't ship a Wayland Qt platform plugin.
    QT_PLATFORM_OVERRIDE=(env QT_QPA_PLATFORM=xcb)
    echo "Detected QT_QPA_PLATFORM=wayland; forcing xcb for emulator."
  fi

  nohup "${QT_PLATFORM_OVERRIDE[@]}" emulator "@$AVD_NAME" -netdelay none -netspeed full -no-snapshot-load >/tmp/queue-android-emulator.log 2>&1 &

  # If GUI launch dies immediately (e.g. Qt platform plugin issue), retry headless.
  sleep 2
  if ! pgrep -f "emulator @${AVD_NAME}" >/dev/null 2>&1; then
    echo "Emulator GUI failed to start; retrying in headless mode."
    nohup "${QT_PLATFORM_OVERRIDE[@]}" emulator "@$AVD_NAME" -netdelay none -netspeed full -no-snapshot-load -no-window -gpu swiftshader_indirect >/tmp/queue-android-emulator.log 2>&1 &
  fi

  for _ in $(seq 1 180); do
    SERIAL="$(get_online_emulator || true)"
    if [[ -n "$SERIAL" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "$SERIAL" ]]; then
    echo "Emulator did not come online in time. Check /tmp/queue-android-emulator.log"
    exit 1
  fi
fi

echo "Waiting for emulator boot completion: $SERIAL"
adb -s "$SERIAL" wait-for-device >/dev/null
for _ in $(seq 1 180); do
  BOOTED="$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)"
  STATE="$(adb -s "$SERIAL" get-state 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$STATE" == "device" && "$BOOTED" == "1" ]]; then
    break
  fi
  sleep 1
done

# Force Expo CLI to target the healthy emulator transport instead of stale mDNS devices.
export ANDROID_SERIAL="$SERIAL"
for port in 8081 8082; do
  adb -s "$SERIAL" reverse "tcp:$port" "tcp:$port" >/dev/null 2>&1 || true
done

APP_ID="$(node -e "const fs=require('fs');const p='app.json';let id='com.derpcat.queue';try{const j=JSON.parse(fs.readFileSync(p,'utf8'));id=(j.expo&&j.expo.android&&j.expo.android.package)||id;}catch{};process.stdout.write(id)")"
METRO_PORT="${EXPO_METRO_PORT:-8081}"
ANDROID_BUILD_VARIANT="${EXPO_ANDROID_BUILD_VARIANT:-debugOptimized}"

run_expo_android_install() {
  local log_file
  log_file="$(mktemp /tmp/queue-android-install-XXXX.log)"

  set +e
  npx expo run:android --variant "$ANDROID_BUILD_VARIANT" 2>&1 | tee "$log_file"
  local status=${PIPESTATUS[0]}
  set -e

  if [[ $status -ne 0 ]] && grep -q "INSTALL_FAILED_INSUFFICIENT_STORAGE" "$log_file"; then
    echo "Install failed due to insufficient emulator storage. Uninstalling existing app and retrying once..."
    adb -s "$SERIAL" uninstall "$APP_ID" >/dev/null 2>&1 || true
    adb -s "$SERIAL" shell pm uninstall --user 0 "$APP_ID" >/dev/null 2>&1 || true

    set +e
    npx expo run:android --variant "$ANDROID_BUILD_VARIANT" 2>&1 | tee "$log_file"
    status=${PIPESTATUS[0]}
    set -e

    if [[ $status -ne 0 ]] && grep -q "INSTALL_FAILED_INSUFFICIENT_STORAGE" "$log_file"; then
      cat <<EOF
Emulator storage is still insufficient after uninstalling $APP_ID.
Next steps:
  1. adb -s "$SERIAL" uninstall "$APP_ID"
  2. Open Android Studio Device Manager and wipe data for the emulator
     or create a fresh AVD.
EOF
    fi
  fi

  rm -f "$log_file"
  return $status
}

# Fingerprint of native-affecting files: package.json + expo config + gradle files.
# Forces a rebuild when native dependencies (unistyles, nitro-modules, reanimated, etc.) change.
compute_native_fingerprint() {
  local fp_file="$PROJECT_ROOT/android/.native-fingerprint"
  local fp_new
  fp_new="$(cat "$PROJECT_ROOT/package.json" 2>/dev/null | cksum | awk '{print $1}')"
  fp_new="$fp_new $(cat "$PROJECT_ROOT/app.json" 2>/dev/null | cksum | awk '{print $1}')"
  if [[ -f "$PROJECT_ROOT/android/app/build.gradle" ]]; then
    fp_new="$fp_new $(cat "$PROJECT_ROOT/android/app/build.gradle" 2>/dev/null | cksum | awk '{print $1}')"
  fi
  if [[ -f "$PROJECT_ROOT/android/build.gradle" ]]; then
    fp_new="$fp_new $(cat "$PROJECT_ROOT/android/build.gradle" 2>/dev/null | cksum | awk '{print $1}')"
  fi
  if [[ -f "$PROJECT_ROOT/android/settings.gradle" ]]; then
    fp_new="$fp_new $(cat "$PROJECT_ROOT/android/settings.gradle" 2>/dev/null | cksum | awk '{print $1}')"
  fi
  echo "$fp_new" | tr -d ' '
}

FORCE_REBUILD="${ANDROID_FORCE_REBUILD:-}"
if [[ -z "$FORCE_REBUILD" ]]; then
  FINGERPRINT_FILE="$PROJECT_ROOT/android/.native-fingerprint"
  CURRENT_FP="$(compute_native_fingerprint)"
  PREVIOUS_FP=""
  if [[ -f "$FINGERPRINT_FILE" ]]; then
    PREVIOUS_FP="$(cat "$FINGERPRINT_FILE")"
  fi
  if [[ "$CURRENT_FP" != "$PREVIOUS_FP" ]]; then
    FORCE_REBUILD=1
    echo "Native fingerprint changed — forcing rebuild..."
  fi
fi

if ! adb -s "$SERIAL" shell pm list packages "$APP_ID" | tr -d '\r' | grep -q "package:$APP_ID"; then
  echo "Dev client not installed ($APP_ID). Building/installing variant '$ANDROID_BUILD_VARIANT'..."
  run_expo_android_install
elif [[ "$FORCE_REBUILD" == "1" ]]; then
  echo "Native deps changed — rebuilding/installing variant '$ANDROID_BUILD_VARIANT'..."
  adb -s "$SERIAL" uninstall "$APP_ID" >/dev/null 2>&1 || true
  run_expo_android_install
else
  echo "Dev client already installed ($APP_ID) and native deps unchanged — skipping build."
fi

# Persist fingerprint on successful run so subsequent runs are stable.
compute_native_fingerprint > "$PROJECT_ROOT/android/.native-fingerprint" 2>/dev/null || true

echo "Launching Expo dev client on $SERIAL"
open_dev_client_when_ready() {
  for _ in $(seq 1 180); do
    if curl -fsS "http://127.0.0.1:$METRO_PORT" >/dev/null 2>&1; then
      DEV_URL_LOCAL="queue://expo-development-client/?url=http://127.0.0.1:$METRO_PORT"
      DEV_URL_EXP="exp+queue://expo-development-client/?url=http://127.0.0.1:$METRO_PORT"
      DEV_URL_LOCAL_TRIPLE="queue:///expo-development-client?url=http://127.0.0.1:$METRO_PORT"
      DEV_URL_EXP_TRIPLE="exp+queue:///expo-development-client?url=http://127.0.0.1:$METRO_PORT"
      # Relaunch exactly once when Metro becomes reachable.
      for _ in $(seq 1 1); do
        adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
        adb -s "$SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_URL_LOCAL" >/dev/null 2>&1 || true
        adb -s "$SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_URL_EXP" >/dev/null 2>&1 || true
        adb -s "$SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_URL_LOCAL_TRIPLE" >/dev/null 2>&1 || true
        adb -s "$SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_URL_EXP_TRIPLE" >/dev/null 2>&1 || true
        sleep 3
      done
      return 0
    fi
    sleep 1
  done
  return 0
}

open_dev_client_when_ready &
exec npx expo start --dev-client --port "$METRO_PORT"
