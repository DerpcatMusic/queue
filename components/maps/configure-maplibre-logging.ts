import { Logger } from "@maplibre/maplibre-react-native";

let isConfigured = false;

type MapLibreLogEvent = {
  level?: string;
  message?: string;
  tag?: string;
};

export function configureMapLibreLogging() {
  if (isConfigured) return;
  isConfigured = true;

  Logger.setLogLevel("warning");
  Logger.setLogCallback((event: MapLibreLogEvent) => {
    const message = event.message ?? "";
    const tag = event.tag ?? "";

    if (tag.includes("Mbgl-HttpRequest") && message.includes("Canceled")) {
      return true;
    }

    return false;
  });
}
