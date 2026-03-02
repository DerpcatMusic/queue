import * as Haptics from "expo-haptics";
import type { KitPressableHaptic } from "./types";

export function triggerSelectionHaptic() {
  if (process.env.EXPO_OS !== "ios") return;
  void Haptics.selectionAsync();
}

export function triggerLightImpactHaptic() {
  if (process.env.EXPO_OS !== "ios") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function triggerHaptic(kind: KitPressableHaptic) {
  if (kind === "impact") {
    triggerLightImpactHaptic();
    return;
  }
  if (kind === "selection") {
    triggerSelectionHaptic();
  }
}
