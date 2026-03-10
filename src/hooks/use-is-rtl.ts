import { I18nManager } from "react-native";

export function useIsRtl() {
  return I18nManager.isRTL;
}
