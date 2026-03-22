# Android Emulator Setup (Native Windows)

This project is now Windows-first for Android development.

## Commands

- Start Android dev flow:
  - `bun run android`
- Start Android emulator explicitly:
  - `bun run android:emulator`
- Run Android doctor checks:
  - `bun run android:doctor`

## What `bun run android` does

1. Starts/uses Windows `adb.exe`.
2. Removes stale `emulator-*` transports.
3. Starts the first AVD if none is online.
4. Waits for full Android boot.
5. Sets `adb reverse` for Expo ports (`8081`, `19000`, `19001`).
6. Builds and installs the debug dev client onto the emulator.
7. Launches the installed debug dev client package.
8. Starts Expo in dev-client mode without `--android` auto-probing.

This emulator flow is intentionally separate from physical phone usage. If you want a real device, use `bun run android:phone` / `bun run android:device`.

This avoids failures like:

`cannot connect to 127.0.0.1:5562 (10061)`

## Prerequisites

1. Android Studio installed on Windows.
2. At least one AVD created in Device Manager.
3. SDK installed at `%LOCALAPPDATA%\Android\Sdk` (or set `ANDROID_SDK_ROOT`).
4. Node/npm (for `npx`) and Bun installed.

## Troubleshooting

1. Run `bun run android:doctor`.
2. If emulator state is broken:
   - `adb kill-server`
   - close emulator process
   - re-run `bun run android`
