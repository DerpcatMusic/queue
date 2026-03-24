import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const targetFile = path.join(
  projectRoot,
  "node_modules",
  "@didit-protocol",
  "sdk-react-native",
  "android",
  "src",
  "main",
  "java",
  "com",
  "sdkreactnative",
  "SdkReactNativeModule.kt",
);

if (!existsSync(targetFile)) {
  console.warn(`[postinstall] Skipping Didit Android patch: ${targetFile} not found.`);
  process.exit(0);
}

const original = readFileSync(targetFile, "utf8");

if (original.includes("no active Activity available when SDK became ready")) {
  console.log("[postinstall] Didit Android activity patch already applied.");
  process.exit(0);
}

let patched = original;

patched = patched.replace(
  '        Log.d(TAG, "startVerification: token=${token.take(8)}..., config=$config")\n        val activity = currentActivity\n        scope.launch {',
  '        Log.d(TAG, "startVerification: token=${token.take(8)}..., config=$config")\n        scope.launch {',
);

patched = patched.replace(
  "                awaitReadyAndLaunchUI(promise, activity)",
  "                awaitReadyAndLaunchUI(promise)",
);

patched = patched.replace(
  '        Log.d(TAG, "startVerificationWithWorkflow: workflowId=$workflowId, vendorData=$vendorData, metadata=$metadata")\n        Log.d(TAG, "startVerificationWithWorkflow: contactDetails=$contactDetails, expectedDetails=$expectedDetails, config=$config")\n        val activity = currentActivity\n        scope.launch {',
  '        Log.d(TAG, "startVerificationWithWorkflow: workflowId=$workflowId, vendorData=$vendorData, metadata=$metadata")\n        Log.d(TAG, "startVerificationWithWorkflow: contactDetails=$contactDetails, expectedDetails=$expectedDetails, config=$config")\n        scope.launch {',
);

patched = patched.replace(
  '    private suspend fun awaitReadyAndLaunchUI(promise: Promise, activity: android.app.Activity?) {\n        if (activity == null) {\n            Log.e(TAG, "awaitReadyAndLaunchUI: no active Activity at call time")\n            val errorResult = mapVerificationResult(\n                VerificationResult.Failed(\n                    error = VerificationError.Unknown("No active Activity available to present verification UI."),\n                    session = null\n                )\n            )\n            promise.resolve(errorResult)\n            return\n        }\n\n        val TIMEOUT_MS = 30_000L\n',
  "    private suspend fun awaitReadyAndLaunchUI(promise: Promise) {\n        val TIMEOUT_MS = 30_000L\n",
);

patched = patched.replace(
  '                    is DiditSdkState.Ready -> {\n                        Log.d(TAG, "awaitReadyAndLaunchUI: launching verification UI")\n                        DiditSdk.launchVerificationUI(activity)\n                        true\n                    }\n',
  '                    is DiditSdkState.Ready -> {\n                        val activity = currentActivity\n                        if (activity == null) {\n                            Log.e(TAG, "awaitReadyAndLaunchUI: no active Activity available when SDK became ready")\n                            val errorResult = mapVerificationResult(\n                                VerificationResult.Failed(\n                                    error = VerificationError.Unknown("No active Activity available to present verification UI."),\n                                    session = null\n                                )\n                            )\n                            promise.resolve(errorResult)\n                            return@first true\n                        }\n                        Log.d(TAG, "awaitReadyAndLaunchUI: launching verification UI")\n                        DiditSdk.launchVerificationUI(activity)\n                        true\n                    }\n',
);

if (patched === original) {
  console.warn("[postinstall] Skipping Didit Android patch: expected patterns not found.");
  process.exit(0);
}

writeFileSync(targetFile, patched, "utf8");
console.log("[postinstall] Patched Didit Android activity handling.");
