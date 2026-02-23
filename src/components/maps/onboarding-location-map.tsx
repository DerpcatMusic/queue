import Constants from "expo-constants";
import { createElement, type ComponentType } from "react";
import { Platform } from "react-native";

import type { OnboardingLocationMapProps } from "./onboarding-location-map.types";

let resolvedImpl: ComponentType<OnboardingLocationMapProps> | null | undefined;

function resolveImpl(): ComponentType<OnboardingLocationMapProps> | null {
  if (resolvedImpl !== undefined) {
    return resolvedImpl;
  }

  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require("./onboarding-location-map.web") as {
      OnboardingLocationMap: ComponentType<OnboardingLocationMapProps>;
    };
    resolvedImpl = web.OnboardingLocationMap;
    return resolvedImpl;
  }

  if (Constants.appOwnership === "expo") {
    // Expo Go cannot load native map modules; use fallback-safe implementation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require("./onboarding-location-map.web") as {
      OnboardingLocationMap: ComponentType<OnboardingLocationMapProps>;
    };
    resolvedImpl = web.OnboardingLocationMap;
    return resolvedImpl;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require("./onboarding-location-map.native") as {
      OnboardingLocationMap: ComponentType<OnboardingLocationMapProps>;
    };
    resolvedImpl = native.OnboardingLocationMap;
    return resolvedImpl;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require("./onboarding-location-map.web") as {
      OnboardingLocationMap: ComponentType<OnboardingLocationMapProps>;
    };
    resolvedImpl = web.OnboardingLocationMap;
    return resolvedImpl;
  }
}

export function OnboardingLocationMap(props: OnboardingLocationMapProps) {
  const Impl = resolveImpl();
  if (!Impl) return null;
  return createElement(Impl, props);
}
