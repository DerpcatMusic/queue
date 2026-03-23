import { Text, TextInput, View } from "react-native";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
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
    <View style={{ gap: BrandSpacing.xs + 2 }}>
      {label ? (
        <Text
          style={{
            ...BrandType.caption,
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
        className="flex-row items-center"
        style={{
          minHeight: BrandSpacing.xxl + 18,
          paddingHorizontal: BrandSpacing.md,
          paddingVertical: BrandSpacing.sm,
          borderWidth: 1,
          borderColor: hasError ? (palette.danger as string) : (palette.borderStrong as string),
          borderRadius: BrandRadius.input,
          borderCurve: "continuous",
          gap: BrandSpacing.sm,
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
              minHeight: BrandSpacing.iconContainer + 10,
              color: palette.text as string,
              ...BrandType.bodyMedium,
              paddingVertical: BrandSpacing.sm + 2,
              includeFontPadding: false,
            },
            style,
          ]}
        />
        {trailing ? <View>{trailing}</View> : null}
      </View>
      {hasError ? (
        <Text style={{ ...BrandType.micro, lineHeight: BrandSpacing.md + 4, color: palette.danger as string }} selectable>
          {errorText}
        </Text>
      ) : helperText ? (
        <Text
          style={{ ...BrandType.micro, lineHeight: BrandSpacing.md + 4, color: palette.textMuted as string }}
          selectable
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
