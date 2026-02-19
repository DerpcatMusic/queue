import Constants from "expo-constants";
import { createElement, type ComponentType } from "react";
import { Platform } from "react-native";

import type { InstructorZonesMapProps } from "./instructor-zones-map.types";

let resolvedImpl: ComponentType<InstructorZonesMapProps> | null | undefined;

function resolveImpl(): ComponentType<InstructorZonesMapProps> | null {
  if (resolvedImpl !== undefined) {
    return resolvedImpl;
  }

  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webModule = require("./instructor-zones-map-component.web") as {
      InstructorZonesMap: ComponentType<InstructorZonesMapProps>;
    };
    resolvedImpl = webModule.InstructorZonesMap;
    return resolvedImpl;
  }

  if (Constants.appOwnership === "expo") {
    resolvedImpl = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeModule = require("./instructor-zones-map-component.native") as {
      InstructorZonesMap: ComponentType<InstructorZonesMapProps>;
    };
    resolvedImpl = nativeModule.InstructorZonesMap;
    return resolvedImpl;
  } catch {
    resolvedImpl = null;
    return null;
  }
}

export function InstructorZonesMap(props: InstructorZonesMapProps) {
  const Impl = resolveImpl();
  if (!Impl) return null;

  return createElement(Impl, props);
}
