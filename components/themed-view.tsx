import { I18nManager, View, type ViewProps } from "react-native";

import { Brand } from "@/constants/brand";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    {
      light: lightColor ?? Brand.light.appBg,
      dark: darkColor ?? Brand.dark.appBg,
    },
    "background",
  );

  return (
    <View
      style={[
        { backgroundColor, direction: I18nManager.isRTL ? "rtl" : "ltr" },
        style,
      ]}
      {...otherProps}
    />
  );
}
