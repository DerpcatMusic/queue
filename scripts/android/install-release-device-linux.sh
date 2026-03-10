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

run_autolinking_probe() {
  (
    cd "$PROJECT_ROOT/android"
    timeout 45s node --no-warnings --eval "require('expo/bin/autolinking')" \
      expo-modules-autolinking resolve --platform android --json >/dev/null
  )
}

quarantine_stale_node_module_android_outputs() {
  local quarantine_root="$PROJECT_ROOT/.gradle-user-home/autolinking-quarantine"
  local ts
  ts="$(date +%s)"

  mkdir -p "$quarantine_root"
  shopt -s nullglob

  local android_dirs=(
    "$PROJECT_ROOT"/node_modules/*/android
    "$PROJECT_ROOT"/node_modules/@*/*/android
  )

  local android_dir=""
  local stale_dir=""
  local relative=""
  local safe=""
  local moved_any=false

  for android_dir in "${android_dirs[@]}"; do
    [[ -d "$android_dir" ]] || continue
    for stale_dir in "$android_dir/.cxx" "$android_dir/build"; do
      [[ -d "$stale_dir" ]] || continue
      relative="${stale_dir#$PROJECT_ROOT/}"
      safe="${relative//\//__}"
      safe="${safe//./_}"
      if mv "$stale_dir" "$quarantine_root/${safe}_${ts}" 2>/dev/null; then
        moved_any=true
      else
        rm -rf "$stale_dir" 2>/dev/null || true
        moved_any=true
      fi
    done
  done

  shopt -u nullglob

  if [[ "$moved_any" == "true" ]]; then
    echo "Quarantined stale module Android build artifacts under: $quarantine_root"
  fi
}

clean_stale_app_release_outputs() {
  rm -rf \
    "$PROJECT_ROOT/android/app/build/intermediates/incremental/packageRelease" \
    "$PROJECT_ROOT/android/app/build/intermediates/incremental/assembleRelease" \
    "$PROJECT_ROOT/android/app/build/intermediates/apk/release" \
    "$PROJECT_ROOT/android/app/build/intermediates/packaged_manifests/release" \
    "$PROJECT_ROOT/android/app/build/outputs/apk/release"
}

run_release_build() {
  (
    cd android
    NODE_ENV=production ./gradlew "${GRADLE_ARGS[@]}"
  )
}

ensure_android_project
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$PROJECT_ROOT/android/local.properties"

# Avoid stale global daemon/lock issues and cross-filesystem cache behavior.
export GRADLE_USER_HOME="$PROJECT_ROOT/.gradle-user-home"
find "$GRADLE_USER_HOME" -name '*.lck' -delete 2>/dev/null || true
find "$PROJECT_ROOT/android/.gradle" -name '*.lock' -delete 2>/dev/null || true
rm -rf "$PROJECT_ROOT/android/.gradle/configuration-cache" 2>/dev/null || true

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
  ENV_STATE="$(adb -s "$SERIAL" get-state 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$ENV_STATE" != "device" ]]; then
    SERIAL=""
  fi
fi
if [[ -z "$SERIAL" ]]; then
  SERIAL="$(get_device_serial || true)"
fi
if [[ -z "$SERIAL" ]]; then
  cat << 'MSG'
No physical Android device detected.
Connect wirelessly first:
  adb pair <PHONE_IP:PAIR_PORT>
  adb connect <PHONE_IP:ADB_PORT>
Then rerun: bun run android:release:phone
MSG
  exit 1
fi

STATE="$(adb -s "$SERIAL" get-state 2>/dev/null | tr -d '\r\n' || true)"
if [[ "$STATE" != "device" ]]; then
  echo "Device $SERIAL is not in 'device' state (state=$STATE)."
  exit 1
fi

# Ensure downstream tools target the same single device.
export ANDROID_SERIAL="$SERIAL"

APP_ID="$(node -e "const fs=require('fs');let id='com.derpcat.queue';try{const j=JSON.parse(fs.readFileSync('app.json','utf8'));id=(j.expo&&j.expo.android&&j.expo.android.package)||id;}catch{};process.stdout.write(id)")"

echo "Building release APK (NODE_ENV=production, arm64-v8a only)..."
echo "This can be quiet for a few minutes during createBundleReleaseJsAndAssets, processReleaseResources, and minifyReleaseWithR8."

GRADLE_ARGS=(
  app:assembleRelease
  -PreactNativeArchitectures=arm64-v8a
  -x
  lintVitalAnalyzeRelease
  --max-workers=4
  --no-daemon
  --no-configuration-cache
  --no-build-cache
  -Dorg.gradle.vfs.watch=false
  --console=plain
)

if [[ "${QUEUE_ANDROID_RELEASE_VERBOSE:-0}" == "1" ]]; then
  echo "Verbose Gradle logging enabled via QUEUE_ANDROID_RELEASE_VERBOSE=1"
  GRADLE_ARGS+=(--info --stacktrace)
fi

# Expo autolinking can hang when stale native build outputs exist in node_modules.
if ! run_autolinking_probe; then
  probe_code=$?
  if [[ "$probe_code" -eq 124 ]]; then
    echo "Detected autolinking timeout. Cleaning stale native module build artifacts and retrying..."
    quarantine_stale_node_module_android_outputs
    if ! run_autolinking_probe; then
      echo "Autolinking is still timing out after cleanup. Run: rm -rf node_modules && bun install"
      exit 1
    fi
  else
    echo "Autolinking probe failed with exit code $probe_code"
    exit "$probe_code"
  fi
fi

if ! run_release_build; then
  echo "Release build failed. Cleaning stale release packaging outputs and retrying once..."
  clean_stale_app_release_outputs
  quarantine_stale_node_module_android_outputs
  run_release_build
fi

APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "Release APK not found at $APK_PATH"
  exit 1
fi

echo "Installing release APK on $SERIAL"
adb -s "$SERIAL" install -r "$APK_PATH"

adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

echo "Installed and launched release app ($APP_ID) on $SERIAL"
