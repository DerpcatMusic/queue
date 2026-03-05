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

if ! adb -s "$SERIAL" shell pm list packages "$APP_ID" | tr -d '\r' | grep -q "package:$APP_ID"; then
  echo "Dev client not installed ($APP_ID). Building/installing now..."
  npx expo run:android
fi

echo "Launching Expo dev client on $SERIAL"
exec npx expo start --dev-client --android
