import type { ViewStyle } from "react-native";

type NativeShadowKind = "surface" | "lifted";

const noShadows: Record<NativeShadowKind, ViewStyle> = {
  surface: {},
  lifted: {},
};

export function getNativeShadowStyle(kind: NativeShadowKind): ViewStyle {
  return noShadows[kind];
}
