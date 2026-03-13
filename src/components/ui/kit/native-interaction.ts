import * as Haptics from "expo-haptics";

type KitHapticKind = "none" | "selection" | "impact";

export function triggerSelectionHaptic() {
  if (process.env.EXPO_OS !== "ios") return;
  void Haptics.selectionAsync();
}

export function triggerLightImpactHaptic() {
  if (process.env.EXPO_OS !== "ios") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function triggerHaptic(kind: KitHapticKind) {
  if (kind === "impact") {
    triggerLightImpactHaptic();
    return;
  }
  if (kind === "selection") {
    triggerSelectionHaptic();
  }
}
