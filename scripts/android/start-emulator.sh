#!/bin/bash
set -e

DEVICE="${1:-Medium_Phone_API_36.1}"
SDK_ROOT="/home/derpcat/Android/Sdk"
EMULATOR="$SDK_ROOT/emulator/emulator"
ADB="$SDK_ROOT/platform-tools/adb"

# Check if already running
if $ADB devices | grep -q "emulator"; then
  echo "Emulator already running"
  exit 0
fi

echo "Starting emulator: $DEVICE"
$EMULATOR @"$DEVICE" -no-boot-animate &
EMULATOR_PID=$!

# Wait for boot
echo "Waiting for emulator to boot..."
until $ADB shell getprop sys.boot_completed > /dev/null 2>&1; do
  sleep 2
done

# Unlock screen
$ADB shell input keyevent 82

echo "Emulator ready: $DEVICE (PID: $EMULATOR_PID)"
