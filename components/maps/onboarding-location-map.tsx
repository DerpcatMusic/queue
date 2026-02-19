import { createElement, type ComponentType } from "react";
import { Platform } from "react-native";

import type { OnboardingLocationMapProps } from "./onboarding-location-map.types";

let resolvedImpl: ComponentType<OnboardingLocationMapProps> | undefined;

function resolveImpl() {
  if (resolvedImpl) {
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

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const native = require("./onboarding-location-map.native") as {
    OnboardingLocationMap: ComponentType<OnboardingLocationMapProps>;
  };
  resolvedImpl = native.OnboardingLocationMap;
  return resolvedImpl;
}

export function OnboardingLocationMap(props: OnboardingLocationMapProps) {
  const Impl = resolveImpl();
  return createElement(Impl, props);
}
