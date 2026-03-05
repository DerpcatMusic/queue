import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const targetFile = path.join(
  projectRoot,
  "node_modules",
  "react-native-css-interop",
  "dist",
  "runtime",
  "components.js",
);

const deprecatedSafeAreaInteropPattern =
  /\(0,\s*api_1\.cssInterop\)\(react_native_1\.SafeAreaView,\s*\{\s*className:\s*"style"\s*\}\);\r?\n/;

if (!existsSync(targetFile)) {
  console.warn("[postinstall] Skipping react-native-css-interop patch: target file not found.");
  process.exit(0);
}

const original = readFileSync(targetFile, "utf8");

if (!original.includes("react_native_1.SafeAreaView")) {
  console.log(
    "[postinstall] react-native-css-interop patch not needed: deprecated SafeAreaView interop is absent.",
  );
  process.exit(0);
}

const patched = original.replace(deprecatedSafeAreaInteropPattern, "");

if (patched === original) {
  console.warn(
    "[postinstall] Skipping react-native-css-interop patch: expected pattern not found.",
  );
  process.exit(0);
}

writeFileSync(targetFile, patched, "utf8");
console.log("[postinstall] Patched react-native-css-interop SafeAreaView interop.");
