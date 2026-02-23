import { Text, TextInput, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useKitTheme } from "./use-kit-theme";
import type { KitTextFieldProps } from "./types";

export function KitTextField({
  label,
  helperText,
  errorText,
  leading,
  trailing,
  style,
  placeholderTextColor,
  ...inputProps
}: KitTextFieldProps) {
  const { foreground, background, border } = useKitTheme();
  const hasError = Boolean(errorText);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: foreground.secondary,
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          minHeight: 50,
          borderWidth: 1.2,
          borderRadius: BrandRadius.input,
          borderCurve: "continuous",
          paddingHorizontal: 12,
          gap: 8,
          flexDirection: "row",
          alignItems: "center",
          borderColor: hasError ? foreground.danger : border.secondary,
          backgroundColor: background.glass,
        }}
      >
        {leading ? <View>{leading}</View> : null}
        <TextInput
          {...inputProps}
          placeholderTextColor={placeholderTextColor ?? (foreground.muted as string)}
          style={[
            {
              flex: 1,
              minHeight: 48,
              color: foreground.secondary,
              fontSize: 15,
              paddingVertical: 10,
              includeFontPadding: false,
            },
            style,
          ]}
        />
        {trailing ? <View>{trailing}</View> : null}
      </View>
      {hasError ? (
        <Text style={{ fontSize: 12, lineHeight: 16, color: foreground.danger }}>{errorText}</Text>
      ) : helperText ? (
        <Text style={{ fontSize: 12, lineHeight: 16, color: foreground.muted }}>{helperText}</Text>
      ) : null}
    </View>
  );
}
