import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const nestedReactNavigationNative = path.join(
  projectRoot,
  "node_modules",
  "expo-router",
  "node_modules",
  "@react-navigation",
  "native",
);

if (!existsSync(nestedReactNavigationNative)) {
  console.log("[postinstall] Expo Router React Navigation dedupe not needed.");
  process.exit(0);
}

rmSync(nestedReactNavigationNative, { force: true, recursive: true });
console.log("[postinstall] Removed expo-router nested @react-navigation/native for Metro dedupe.");
