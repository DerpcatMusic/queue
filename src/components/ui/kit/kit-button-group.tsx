import type { ReactNode } from "react";
import type { DimensionValue, TextStyle, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
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
  groupBackgroundColor?: string;
  selectedBackgroundColor?: string;
  labelColor?: string;
  selectedLabelColor?: string;
  dividerColor?: string;
};

const SIZE_PRESET: Record<
  KitButtonGroupSize,
  { minHeight: number; radius: number; paddingX: number; inset: number; separatorInset: number }
> = {
  sm: {
    minHeight: BrandSpacing.iconContainer,
    radius: BrandRadius.buttonSubtle,
    paddingX: BrandSpacing.componentPadding,
    inset: 2,
    separatorInset: BrandSpacing.sm + 1,
  },
  md: {
    minHeight: BrandSpacing.iconContainer,
    radius: BrandRadius.button,
    paddingX: BrandSpacing.lg,
    inset: 3,
    separatorInset: BrandSpacing.sm + 3,
  },
  lg: {
    minHeight: BrandSpacing.xxl + 6,
    radius: BrandRadius.button,
    paddingX: BrandSpacing.xl - 2,
    inset: 3,
    separatorInset: BrandSpacing.sm + 4,
  },
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

  const resolvedGroupBg =
    groupBackgroundColor ??
    (tone === "onPrimary" ? String(palette.primaryPressed) : String(palette.surfaceAlt));
  const resolvedSelectedBg =
    selectedBackgroundColor ??
    (tone === "onPrimary" ? String(palette.primary) : String(palette.surfaceElevated));
  const resolvedLabelColorFinal =
    labelColor ?? (tone === "onPrimary" ? String(palette.onPrimary) : String(palette.textMuted));
  const resolvedSelectedLabelColorFinal = selectedLabelColor ?? String(palette.onPrimary);
  const resolvedDividerColorFinal =
    dividerColor ??
    (tone === "onPrimary" ? String(palette.onPrimary) : String(palette.borderStrong));

  return (
    <View
      accessible
      className="overflow-hidden rounded-button"
      style={[
        {
          width: fullWidth ? "100%" : width,
          maxWidth,
          alignSelf: fullWidth ? "stretch" : alignSelfMap[align],
          backgroundColor: resolvedGroupBg,
          flexWrap: wraps ? "wrap" : "nowrap",
          padding: BrandSpacing.sm - 2,
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
            className="relative flex-1"
            style={[
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
                className="absolute"
                style={[
                  {
                    left: 0,
                    width: StyleSheet.hairlineWidth,
                    top: metrics.separatorInset,
                    bottom: metrics.separatorInset,
                    backgroundColor: resolvedDividerColorFinal,
                  },
                ]}
              />
            ) : null}
            {selected ? (
              <View
                pointerEvents="none"
                className="absolute"
                style={[
                  {
                    top: metrics.inset,
                    right: metrics.inset,
                    bottom: metrics.inset,
                    left: metrics.inset,
                    borderRadius: metrics.radius,
                    backgroundColor: resolvedSelectedBg,
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
              className="w-full"
              style={({ pressed }) => [
                {
                  borderRadius: metrics.radius,
                  backgroundColor: option.disabled
                    ? String(palette.surface)
                    : pressed
                      ? tone === "onPrimary"
                        ? String(palette.primaryPressed)
                        : String(palette.surface)
                      : undefined,
                },
              ]}
            >
              <View
                className="flex-row items-center justify-center"
                style={[
                  {
                    minHeight: metrics.minHeight,
                    paddingHorizontal: metrics.paddingX,
                  },
                ]}
              >
                {option.icon ? (
                  <View className="items-center justify-center">{option.icon}</View>
                ) : null}
                <Text
                  numberOfLines={1}
                  className="text-center font-bold"
                  style={
                    {
                      color: selected ? resolvedSelectedLabelColorFinal : resolvedLabelColorFinal,
                      ...BrandType.bodyMedium,
                      includeFontPadding: false,
                    } as TextStyle
                  }
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
