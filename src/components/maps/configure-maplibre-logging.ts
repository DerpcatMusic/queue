import { NativeModules } from "react-native";
import { resolveMapLibreRuntime } from "@/components/maps/maplibre-runtime";

let isConfigured = false;

type MapLibreLogEvent = {
  level?: string;
  message?: string;
  tag?: string;
};

export function configureMapLibreLogging() {
  if (isConfigured) return;

  // In some builds (or before native module init), the logging bridge is absent.
  // Calling Logger then can throw from NativeEventEmitter construction.
  if (!NativeModules?.MLRNLogging) return;

  try {
    const mapLibreModule = resolveMapLibreRuntime();
    const logger = mapLibreModule?.Logger;
    if (!logger) return;

    logger.setLogLevel("warning");
    logger.setLogCallback((event: MapLibreLogEvent) => {
      const message = event.message ?? "";
      const tag = event.tag ?? "";

      if (tag.includes("Mbgl-HttpRequest") && message.includes("Canceled")) {
        return true;
      }

      return false;
    });
    isConfigured = true;
  } catch {
    // Keep map usable even if logger wiring fails.
  }
}
