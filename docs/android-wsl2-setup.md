# Android Emulator Setup (WSL2 Fedora 43 + Windows)

## What was configured
- Installed Linux dependencies in WSL:
  - `java-21-openjdk`
  - `android-tools` (`adb`)
- Added cross-OS wrapper scripts:
  - `scripts/android/bin/adb`
  - `scripts/android/bin/emulator`
  - `scripts/android/win-adb.ps1`
  - `scripts/android/win-emulator.ps1`
  - `scripts/android/start-expo-wsl.sh`
- Added npm script:
  - `npm run android:wsl`

## Why this approach
Running the Android Emulator directly inside WSL2 is often unstable because hardware acceleration requirements are VM-sensitive. This setup runs the emulator on Windows (where acceleration is supported) while running Expo in WSL.

## Run your app (Bun)
From repo root:

```bash
bun run android:wsl
```

Optional: choose an AVD explicitly:

```bash
bash ./scripts/android/start-expo-wsl.sh Pixel_9
```

Run diagnostics first:

```bash
bun run android:wsl:doctor
```

## Quick verification commands

```bash
java -version
adb version
bash ./scripts/android/bin/emulator -list-avds
bash ./scripts/android/bin/adb devices
```

## Troubleshooting
- No AVD found:
  - Create one in Android Studio on Windows (`Tools` -> `Device Manager`).
- Emulator starts but app does not open:
  - Re-run `bun run android:wsl` and wait for `Launching Expo for Android...`.
- `adb` fails intermittently:
  - Restart adb on Windows:
    ```bash
    bash ./scripts/android/bin/adb kill-server
    bash ./scripts/android/bin/adb start-server
    ```
- Network issues from emulator to Metro:
  - Use tunnel mode:
    ```bash
    bunx expo start --tunnel
    ```

## Official references used
- Expo Android emulator workflow: https://docs.expo.dev/workflow/android-studio-emulator/
- Expo environment setup (Android): https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=emulator
- Android Emulator acceleration requirements: https://developer.android.com/studio/run/emulator-acceleration
- Android command line tools and AVD docs: https://developer.android.com/tools
- WSL architecture and behavior: https://learn.microsoft.com/windows/wsl/
