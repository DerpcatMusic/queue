import type { ReactNode } from "react";
import type { ColorValue, DimensionValue, TextStyle, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { triggerSelectionHaptic } from "./native-interaction";

export type KitButtonGroupOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export type KitButtonGroupTone = "surface" | "onPrimary";
export type KitButtonGroupSize = "sm" | "md" | "lg";
export type KitButtonGroupAlign = "start" | "center" | "stretch";

export type KitButtonGroupProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly KitButtonGroupOption<T>[];
  columns?: number;
  size?: KitButtonGroupSize;
  tone?: KitButtonGroupTone;
  align?: KitButtonGroupAlign;
  fullWidth?: boolean;
  width?: DimensionValue;
  maxWidth?: number;
  showSeparators?: boolean;
  style?: ViewStyle;
  groupBackgroundColor?: ColorValue;
  selectedBackgroundColor?: ColorValue;
  labelColor?: ColorValue;
  selectedLabelColor?: ColorValue;
  dividerColor?: ColorValue;
};

const SIZE_PRESET: Record<
  KitButtonGroupSize,
  { minHeight: number; radius: number; paddingX: number; inset: number; separatorInset: number }
> = {
  sm: { minHeight: 40, radius: 10, paddingX: 12, inset: 2, separatorInset: 9 },
  md: { minHeight: 48, radius: 12, paddingX: 16, inset: 3, separatorInset: 11 },
  lg: { minHeight: 54, radius: 14, paddingX: 18, inset: 3, separatorInset: 12 },
};

export function KitButtonGroup<T extends string>({
  value,
  onChange,
  options,
  columns,
  size = "md",
  tone = "surface",
  align = "center",
  fullWidth = false,
  width,
  maxWidth,
  showSeparators = true,
  style,
  groupBackgroundColor,
  selectedBackgroundColor,
  labelColor,
  selectedLabelColor,
  dividerColor,
}: KitButtonGroupProps<T>) {
  const palette = useBrand();
  const metrics = SIZE_PRESET[size];
  const resolvedColumns = Math.max(1, Math.min(columns ?? options.length, options.length));
  const wraps = resolvedColumns < options.length;
  const slotBasis = `${100 / resolvedColumns}%` as DimensionValue;

  const toneDefaults =
    tone === "onPrimary"
      ? {
          groupBackgroundColor: palette.primaryPressed as string,
          selectedBackgroundColor: palette.primarySubtle as string,
          labelColor: palette.onPrimary as string,
          selectedLabelColor: palette.onPrimary as string,
          dividerColor: palette.primary as string,
        }
      : {
          groupBackgroundColor: palette.surfaceAlt as string,
          selectedBackgroundColor: palette.surfaceElevated as string,
          labelColor: palette.textMuted as string,
          selectedLabelColor: palette.text as string,
          dividerColor: palette.borderStrong as string,
        };

  return (
    <View
      accessible
      style={[
        styles.group,
        {
          width: fullWidth ? "100%" : width,
          maxWidth,
          alignSelf: fullWidth ? "stretch" : alignSelfMap[align],
          backgroundColor: (groupBackgroundColor ?? toneDefaults.groupBackgroundColor) as string,
          flexWrap: wraps ? "wrap" : "nowrap",
        },
        style,
      ]}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const showDivider = showSeparators && !wraps && index > 0;

        return (
          <View
            key={option.value}
            style={[
              styles.slot,
              {
                width: slotBasis,
                maxWidth: wraps ? slotBasis : undefined,
                minWidth: wraps ? slotBasis : undefined,
              },
            ]}
          >
            {showDivider ? (
              <View
                pointerEvents="none"
                style={[
                  styles.divider,
                  {
                    top: metrics.separatorInset,
                    bottom: metrics.separatorInset,
                    backgroundColor: (dividerColor ?? toneDefaults.dividerColor) as string,
                  },
                ]}
              />
            ) : null}
            {selected ? (
              <View
                pointerEvents="none"
                style={[
                  styles.selectionFill,
                  {
                    top: metrics.inset,
                    right: metrics.inset,
                    bottom: metrics.inset,
                    left: metrics.inset,
                    borderRadius: metrics.radius,
                    backgroundColor: (selectedBackgroundColor ??
                      toneDefaults.selectedBackgroundColor) as string,
                  },
                ]}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityState={{ selected, disabled: option.disabled }}
              disabled={option.disabled}
              onPress={() => {
                if (option.disabled) return;
                triggerSelectionHaptic();
                onChange(option.value);
              }}
              style={({ pressed }) => [
                styles.segmentPressable,
                {
                  backgroundColor: option.disabled
                    ? ((groupBackgroundColor ?? toneDefaults.groupBackgroundColor) as string)
                    : pressed
                      ? ((selectedBackgroundColor ??
                          toneDefaults.selectedBackgroundColor) as string)
                      : undefined,
                  borderRadius: metrics.radius,
                } as ViewStyle,
              ]}
            >
              <View
                style={[
                  styles.segmentContent,
                  {
                    minHeight: metrics.minHeight,
                    paddingHorizontal: metrics.paddingX,
                  } as ViewStyle,
                ]}
              >
                {option.icon ? <View style={styles.iconWrap}>{option.icon}</View> : null}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label as TextStyle,
                    {
                      color: selected
                        ? (selectedLabelColor ?? toneDefaults.selectedLabelColor)
                        : (labelColor ?? toneDefaults.labelColor),
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const alignSelfMap: Record<KitButtonGroupAlign, "flex-start" | "center" | "stretch"> = {
  start: "flex-start",
  center: "center",
  stretch: "stretch",
};

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 6,
    overflow: "hidden",
  },
  slot: {
    position: "relative",
    alignSelf: "stretch",
    flex: 1,
  },
  divider: {
    position: "absolute",
    left: 0,
    width: StyleSheet.hairlineWidth,
  },
  selectionFill: {
    position: "absolute",
  },
  segmentPressable: {
    width: "100%",
  },
  segmentContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
    zIndex: 1,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...BrandType.bodyMedium,
    fontSize: 15,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
  },
});
