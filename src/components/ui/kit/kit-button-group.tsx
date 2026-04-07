import type { ReactNode } from "react";
import type { ColorValue, DimensionValue, TextStyle, ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
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
  sm: {
    minHeight: BrandSpacing.controlSm,
    radius: BrandRadius.md,
    paddingX: BrandSpacing.sm,
    inset: BrandSpacing.xs,
    separatorInset: BrandSpacing.sm,
  },
  md: {
    minHeight: BrandSpacing.controlMd,
    radius: BrandRadius.lg,
    paddingX: BrandSpacing.lg,
    inset: BrandSpacing.xs,
    separatorInset: BrandSpacing.md,
  },
  lg: {
    minHeight: BrandSpacing.controlLg,
    radius: BrandRadius.card,
    paddingX: BrandSpacing.lg,
    inset: BrandSpacing.xs,
    separatorInset: BrandSpacing.md,
  },
};

// Tone presets resolved from theme
const TONE_PRESETS = {
  surface: {
    groupBgKey: "surfaceAlt",
    selectedBgKey: "surfaceElevated",
    labelKey: "textMuted",
    selectedLabelKey: "text",
    dividerKey: "borderStrong",
  },
  onPrimary: {
    groupBgKey: "primaryPressed",
    selectedBgKey: "primarySubtle",
    labelKey: "onPrimary",
    selectedLabelKey: "onPrimary",
    dividerKey: "primary",
  },
} as const;

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
  const theme = useTheme();
  const metrics = SIZE_PRESET[size];
  const resolvedColumns = Math.max(1, Math.min(columns ?? options.length, options.length));
  const wraps = resolvedColumns < options.length;
  const slotBasis = `${100 / resolvedColumns}%` as DimensionValue;
  const tonePreset = TONE_PRESETS[tone];

  return (
    <View
      style={[
        styles.group,
        {
          width: fullWidth ? "100%" : width,
          maxWidth,
          alignSelf: fullWidth ? "stretch" : alignSelfMap[align],
          backgroundColor: groupBackgroundColor ?? theme.color[tonePreset.groupBgKey],
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
                    backgroundColor: dividerColor ?? theme.color[tonePreset.dividerKey],
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
                    backgroundColor:
                      selectedBackgroundColor ?? theme.color[tonePreset.selectedBgKey],
                  },
                ]}
              />
            ) : null}
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityState={{ checked: selected, disabled: option.disabled }}
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
                    ? (groupBackgroundColor ?? theme.color[tonePreset.groupBgKey])
                    : pressed
                      ? (selectedBackgroundColor ?? theme.color[tonePreset.selectedBgKey])
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
                        ? (selectedLabelColor ?? theme.color[tonePreset.selectedLabelKey])
                        : (labelColor ?? theme.color[tonePreset.labelKey]),
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
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.sm,
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
    gap: BrandSpacing.sm,
    position: "relative",
    zIndex: 1,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...BrandType.bodyMedium,
    // Intentional override: selected labels need bolder weight for visual prominence
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
  },
});
