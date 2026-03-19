import { Text, TextInput, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
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
  const palette = useBrand();
  const hasError = Boolean(errorText);
  const isMultiline = Boolean(inputProps.multiline);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: palette.text as string,
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
          borderWidth: 1,
          borderColor: hasError ? (palette.danger as string) : (palette.borderStrong as string),
          borderRadius: BrandRadius.input,
          borderCurve: "continuous",
          paddingHorizontal: 12,
          gap: 8,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: hasError
            ? (palette.dangerSubtle as string)
            : (palette.surfaceElevated as string),
        }}
      >
        {leading ? <View>{leading}</View> : null}
        <TextInput
          {...inputProps}
          placeholderTextColor={placeholderTextColor ?? (palette.textMuted as string)}
          selectionColor={palette.primary as string}
          cursorColor={palette.primary as string}
          clearButtonMode={!isMultiline ? "while-editing" : "never"}
          style={[
            {
              flex: 1,
              minHeight: 48,
              color: palette.text as string,
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
        <Text style={{ fontSize: 12, lineHeight: 16, color: palette.danger as string }} selectable>
          {errorText}
        </Text>
      ) : helperText ? (
        <Text
          style={{ fontSize: 12, lineHeight: 16, color: palette.textMuted as string }}
          selectable
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
