import Constants from "expo-constants";
import { createElement, memo, type ComponentType } from "react";
import { Platform } from "react-native";

import type { InstructorZonesMapProps } from "./instructor-zones-map.types";

let resolvedImpl: ComponentType<InstructorZonesMapProps> | null | undefined;
let resolvedReason: "expo_go" | "native_module_unavailable" | null = null;

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
    resolvedReason = null;
    return resolvedImpl;
  }

  if (Constants.appOwnership === "expo") {
    resolvedImpl = null;
    resolvedReason = "expo_go";
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeModule = require("./instructor-zones-map-component.native") as {
      InstructorZonesMap: ComponentType<InstructorZonesMapProps>;
    };
    resolvedImpl = nativeModule.InstructorZonesMap;
    resolvedReason = null;
    return resolvedImpl;
  } catch {
    resolvedImpl = null;
    resolvedReason = "native_module_unavailable";
    return null;
  }
}

export function getInstructorZonesMapStatus() {
  const implementation = resolveImpl();
  return {
    available: implementation !== null,
    reason: resolvedReason,
  };
}

function InstructorZonesMapInner(props: InstructorZonesMapProps) {
  const Impl = resolveImpl();
  if (!Impl) return null;

  return createElement(Impl, props);
}

export const InstructorZonesMap = memo(InstructorZonesMapInner);
