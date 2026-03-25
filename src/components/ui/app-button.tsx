import { Platform } from "react-native";

import type { AppButtonProps } from "./app-button.types";

export function AppButton(props: AppButtonProps) {
  if (Platform.OS === "ios") {
    const { AppButton: IOSAppButton } =
      require("./app-button.ios") as typeof import("./app-button.ios");
    return <IOSAppButton {...props} />;
  }

  if (Platform.OS === "android") {
    const { AppButton: AndroidAppButton } =
      require("./app-button.android") as typeof import("./app-button.android");
    return <AndroidAppButton {...props} />;
  }

  const { AppButton: WebAppButton } =
    require("./app-button.web") as typeof import("./app-button.web");
  return <WebAppButton {...props} />;
}
