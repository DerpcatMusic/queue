import { StyleSheet, Text, TextInput, View } from "react-native";

import { BrandRadius } from "@/constants/brand";
import { useExpressivePalette } from "./use-expressive-palette";
import type { ExpressiveTextFieldProps } from "./types";

export function ExpressiveTextField({
  label,
  helperText,
  errorText,
  style,
  placeholderTextColor,
  ...inputProps
}: ExpressiveTextFieldProps) {
  const { palette } = useExpressivePalette();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: palette.text }]}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        placeholderTextColor={placeholderTextColor ?? palette.textMuted}
        style={[
          styles.input,
          {
            borderColor: errorText ? palette.danger : palette.border,
            color: palette.text,
            backgroundColor: palette.surface,
          },
          style,
        ]}
      />
      {errorText ? (
        <Text style={[styles.helper, { color: palette.danger }]}>{errorText}</Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: palette.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: BrandRadius.input,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
  },
});
