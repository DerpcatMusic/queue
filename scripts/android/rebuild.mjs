#!/usr/bin/env node
/**
 * android:rebuild — clears native fingerprint and triggers a full rebuild.
 * Works cross-platform by delegating to the appropriate start script with
 * ANDROID_FORCE_REBUILD=1.
 */
import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const fingerprint = path.join(projectRoot, "android", ".native-fingerprint");
if (existsSync(fingerprint)) {
  rmSync(fingerprint);
  console.log("Cleared native fingerprint.");
} else {
  console.log("No native fingerprint found — will compute on next run.");
}

const scriptDir = path.join(__dirname);
const isWin = process.platform === "win32";

if (isWin) {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(scriptDir, "start-expo-windows.ps1"),
    ],
    {
      stdio: "inherit",
      env: { ...process.env, ANDROID_FORCE_REBUILD: "1" },
    }
  );
  process.exit(result.status ?? 1);
} else {
  const result = spawnSync(
    "bash",
    [path.join(scriptDir, "start-expo-linux.sh")],
    {
      stdio: "inherit",
      env: { ...process.env, ANDROID_FORCE_REBUILD: "1" },
    }
  );
  process.exit(result.status ?? 1);
}
