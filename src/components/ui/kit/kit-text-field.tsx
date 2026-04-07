import { Text, TextInput, View } from "react-native";
import { I18nManager } from "react-native";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
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
  const theme = useTheme();
  const hasError = Boolean(errorText);
  const isMultiline = Boolean(inputProps.multiline);

  return (
    <View style={{ gap: BrandSpacing.sm }}>
      {label ? (
        <Text
          nativeID={inputProps.nativeID ? `${inputProps.nativeID}-label` : undefined}
          style={{
            ...BrandType.caption,
            color: theme.color.text,
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: BrandSpacing.controlLg,
          paddingHorizontal: BrandSpacing.md,
          paddingVertical: BrandSpacing.sm,
          borderWidth: BorderWidth.thin,
          borderColor: hasError ? theme.color.danger : theme.color.borderStrong,
          borderRadius: BrandRadius.input,
          borderCurve: "continuous",
          gap: BrandSpacing.sm,
          backgroundColor: hasError ? theme.color.dangerSubtle : theme.color.surfaceElevated,
        }}
      >
        {leading ? <View>{leading}</View> : null}
        <TextInput
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          accessibilityHint={inputProps.accessibilityHint ?? helperText ?? errorText ?? undefined}
          textAlign={inputProps.textAlign ?? (I18nManager.isRTL ? "right" : "left")}
          placeholderTextColor={placeholderTextColor ?? theme.color.textMuted}
          selectionColor={theme.color.primary}
          cursorColor={theme.color.primary}
          clearButtonMode={!isMultiline ? "while-editing" : "never"}
          style={[
            {
              flex: 1,
              minHeight: BrandSpacing.controlMd,
              color: theme.color.text,
              ...BrandType.bodyMedium,
              paddingVertical: BrandSpacing.sm,
              includeFontPadding: false,
            },
            style,
          ]}
        />
        {trailing ? <View>{trailing}</View> : null}
      </View>
      {hasError ? (
        <Text
          style={{
            ...BrandType.micro,
            color: theme.color.danger,
          }}
        >
          {errorText}
        </Text>
      ) : helperText ? (
        <Text
          style={{
            ...BrandType.micro,
            color: theme.color.textMuted,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
