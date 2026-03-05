import { Text, TextInput, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import type { KitTextFieldProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

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
  const { foreground, background, color } = useKitTheme();
  const hasError = Boolean(errorText);
  const isMultiline = Boolean(inputProps.multiline);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: foreground.secondary,
            includeFontPadding: false,
          }}
          selectable
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          minHeight: 50,
          borderRadius: BrandRadius.input,
          borderCurve: "continuous",
          paddingHorizontal: 12,
          gap: 8,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: hasError ? background.dangerSubtle : background.surfaceSecondary,
        }}
      >
        {leading ? <View>{leading}</View> : null}
        <TextInput
          {...inputProps}
          placeholderTextColor={placeholderTextColor ?? (foreground.muted as string)}
          selectionColor={color.primary as string}
          cursorColor={color.primary as string}
          clearButtonMode={!isMultiline ? "while-editing" : "never"}
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
        <Text style={{ fontSize: 12, lineHeight: 16, color: foreground.danger }} selectable>
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={{ fontSize: 12, lineHeight: 16, color: foreground.muted }} selectable>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
