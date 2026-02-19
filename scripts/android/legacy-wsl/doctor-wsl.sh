#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/bin:$PATH"

PASS=0
FAIL=0

ok() {
  echo "[OK] $1"
  PASS=$((PASS + 1))
}

bad() {
  echo "[FAIL] $1"
  FAIL=$((FAIL + 1))
}

check_cmd() {
  local cmd="$1"
  local label="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$label"
  else
    bad "$label"
  fi
}

check_cmd java "java installed in WSL"
check_cmd powershell.exe "WSL<->Windows interop available"
check_cmd adb "adb installed in WSL"
check_cmd bun "bun installed"

if bash "$SCRIPT_DIR/bin/adb" version >/dev/null 2>&1; then
  ok "Windows adb reachable through wrapper"
else
  bad "Windows adb reachable through wrapper"
fi

AVD_LIST="$(bash "$SCRIPT_DIR/bin/emulator" -list-avds 2>/dev/null | tr -d '\r' || true)"
if [[ -n "$AVD_LIST" ]]; then
  ok "At least one Windows AVD exists"
  echo "$AVD_LIST" | sed 's/^/  - /'
else
  bad "At least one Windows AVD exists"
fi

if bash "$SCRIPT_DIR/bin/adb" devices 2>/dev/null | tr -d '\r' | grep -q '^emulator-[0-9]'; then
  ok "Running emulator detected"
else
  echo "[WARN] No running emulator detected"
fi

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "Doctor result: $PASS checks passed, $FAIL failed"
  exit 1
fi

echo ""
echo "Doctor result: $PASS checks passed, $FAIL failed"
