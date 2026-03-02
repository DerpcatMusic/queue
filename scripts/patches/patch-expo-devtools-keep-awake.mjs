import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");

const targets = [
  path.join(projectRoot, "node_modules", "expo", "src", "launch", "withDevTools.tsx"),
  path.join(projectRoot, "node_modules", "expo", "src", "launch", "withDevTools.ios.tsx"),
];

for (const targetFile of targets) {
  if (!existsSync(targetFile)) {
    console.warn(`[postinstall] Skipping expo keep-awake patch: ${targetFile} not found.`);
    continue;
  }

  const original = readFileSync(targetFile, "utf8");

  if (original.includes("return () => {}; // patched: disable keep-awake")) {
    console.log(`[postinstall] Expo keep-awake patch already applied: ${path.basename(targetFile)}`);
    continue;
  }

  const pattern = /return \(\) => useKeepAwake\(ExpoKeepAwakeTag, \{ suppressDeactivateWarnings: true \}\);/;
  if (!pattern.test(original)) {
    console.warn(`[postinstall] Skipping expo keep-awake patch: expected pattern not found in ${path.basename(targetFile)}.`);
    continue;
  }

  const patched = original.replace(
    pattern,
    "return () => {}; // patched: disable keep-awake",
  );

  writeFileSync(targetFile, patched, "utf8");
  console.log(`[postinstall] Patched Expo keep-awake devtools hook: ${path.basename(targetFile)}`);
}
