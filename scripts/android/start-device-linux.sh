#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"

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

ensure_android_project() {
  if [[ -d "$PROJECT_ROOT/android" ]]; then
    return 0
  fi
  echo "Android project not found. Generating native Android project via Expo prebuild..."
  npx expo prebuild --platform android --non-interactive
}

normalize_serial() {
  local raw="$1"
  local normalized="$raw"

  normalized="${normalized%._adb-tls-connect._tcp}"
  normalized="${normalized%._adb-tls-pairing._tcp}"
  normalized="$(echo "$normalized" | sed -E 's/[[:space:]]+\([0-9]+\)$//')"
  echo "$normalized"
}

ensure_android_project
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$PROJECT_ROOT/android/local.properties"

adb start-server >/dev/null

get_device_serial() {
  adb devices | tr -d '\r' | awk '
    BEGIN { fallback = ""; selected = "" }
    /^[[:space:]]*$/ || /^List of devices attached/ { next }
    {
      entryCount = split($0, entry, "\t")
      if (entryCount < 2 || entry[entryCount] != "device") next
      serial = entry[1]
      if (serial ~ /^emulator-/) next
      if (serial !~ /[[:space:]]/) {
        print serial
        selected = serial
        exit
      }
      if (fallback == "") fallback = serial
    }
    END {
      if (selected == "" && fallback != "") print fallback
    }
  '
}

SERIAL="${ANDROID_SERIAL:-}"
if [[ -n "$SERIAL" ]]; then
  SERIAL="$(normalize_serial "$SERIAL")"
  ENV_STATE="$(adb -s "$SERIAL" get-state 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$ENV_STATE" != "device" ]]; then
    SERIAL=""
  fi
fi
if [[ -z "$SERIAL" ]]; then
  SERIAL="$(get_device_serial || true)"
fi
if [[ -n "$SERIAL" ]]; then
  SERIAL="$(normalize_serial "$SERIAL")"
fi
if [[ -z "$SERIAL" ]]; then
  cat << 'MSG'
No physical Android device detected.
Connect wirelessly first:
  adb pair <PHONE_IP:PAIR_PORT>
  adb connect <PHONE_IP:ADB_PORT>
Then rerun: bun run android:phone
MSG
  exit 1
fi

STATE="$(adb -s "$SERIAL" get-state 2>/dev/null | tr -d '\r\n' || true)"
if [[ "$STATE" != "device" ]]; then
  echo "Device $SERIAL is not in 'device' state (state=$STATE)."
  exit 1
fi

# Ensure downstream tools (Expo CLI) target the same single device.
export ANDROID_SERIAL="$SERIAL"
METRO_PORT="${EXPO_METRO_PORT:-8082}"

for port in 8081 8082 "$METRO_PORT"; do
  adb -s "$SERIAL" reverse "tcp:$port" "tcp:$port" >/dev/null 2>&1 || true
done

APP_ID="$(node -e "const fs=require('fs');let id='com.derpcat.queue';try{const j=JSON.parse(fs.readFileSync('app.json','utf8'));id=(j.expo&&j.expo.android&&j.expo.android.package)||id;}catch{};process.stdout.write(id)")"

if ! adb -s "$SERIAL" shell pm list packages "$APP_ID" | tr -d '\r' | grep -q "package:$APP_ID"; then
  echo "Dev client not installed on $SERIAL ($APP_ID). Building and installing debug APK..."
  (cd android && ./gradlew app:assembleDebug -x lint -x test --configure-on-demand --build-cache)
  APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
  if [[ ! -f "$APK_PATH" ]]; then
    echo "Debug APK not found at $APK_PATH"
    exit 1
  fi
  adb -s "$SERIAL" install -r "$APK_PATH"
fi

adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

HOST_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
if [[ -z "$HOST_IP" ]]; then
  HOST_IP="$(hostname -I | awk '{print $1}')"
fi
if [[ -z "$HOST_IP" ]]; then
  echo "Could not determine host LAN IP for Metro."
  exit 1
fi

echo "Starting Metro for dev client on $SERIAL (host: $HOST_IP, metro: $METRO_PORT)"
open_dev_client_when_ready() {
  for _ in $(seq 1 180); do
    if curl -fsS "http://127.0.0.1:$METRO_PORT" >/dev/null 2>&1; then
      # Prefer localhost URL so adb reverse works even if LAN routing is flaky.
      DEV_URL_LOCAL="queue://expo-development-client/?url=http://127.0.0.1:$METRO_PORT"
      DEV_URL_LAN="queue://expo-development-client/?url=http://$HOST_IP:$METRO_PORT"
      for _ in $(seq 1 30); do
        adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
        adb -s "$SERIAL" shell am start \
          -a android.intent.action.VIEW \
          -d "$DEV_URL_LOCAL" >/dev/null 2>&1 || true
        adb -s "$SERIAL" shell am start \
          -a android.intent.action.VIEW \
          -d "$DEV_URL_LAN" >/dev/null 2>&1 || true
        sleep 2
      done
      return 0
    fi
    sleep 1
  done
  return 0
}

open_dev_client_when_ready &

if command -v bun >/dev/null 2>&1; then
  exec bun expo start --dev-client --host lan --port "$METRO_PORT"
else
  exec npx expo start --dev-client --host lan --port "$METRO_PORT"
fi
