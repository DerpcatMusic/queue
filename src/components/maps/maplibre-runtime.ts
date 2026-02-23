import { NativeModules } from "react-native";

type MapLibreLogEvent = {
  level?: string;
  message?: string;
  tag?: string;
};

export type MapLibreRuntime = {
  Camera?: unknown;
  CircleLayer?: unknown;
  FillLayer?: unknown;
  LineLayer?: unknown;
  MapView?: unknown;
  ShapeSource?: unknown;
  SymbolLayer?: unknown;
  Logger?: {
    setLogLevel: (level: string) => void;
    setLogCallback: (cb: (event: MapLibreLogEvent) => boolean) => void;
  };
};

export function hasMapLibreNativeBridge() {
  const moduleKeys = Object.keys(NativeModules ?? {});
  return moduleKeys.some((key) => key.startsWith("MLRN"));
}

export function resolveMapLibreRuntime(): MapLibreRuntime | null {
  if (!hasMapLibreNativeBridge()) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require("@maplibre/maplibre-react-native") as
      | MapLibreRuntime
      | undefined;
    if (!runtime || typeof runtime !== "object") return null;
    return runtime;
  } catch {
    return null;
  }
}
