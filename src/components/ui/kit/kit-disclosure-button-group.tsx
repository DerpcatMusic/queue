import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";

import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { triggerSelectionHaptic } from "./native-interaction";

export type KitDisclosureButtonGroupOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  accessibilityLabel?: string;
};

type KitDisclosureButtonGroupProps<T extends string> = {
  value: T;
  options: readonly KitDisclosureButtonGroupOption<T>[];
  expanded: boolean;
  onChange: (value: T) => void;
  onToggleExpanded: () => void;
  showTriggerWhenExpanded?: boolean;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  accessibilityLabel: string;
  size?: "sm" | "md";
  style?: ViewStyle;
  railColor?: string;
  selectedColor?: string;
  labelColor?: string;
  selectedLabelColor?: string;
  dividerColor?: string;
};

const SIZE_PRESETS = {
  sm: {
    railPadding: BrandSpacing.xs,
    railRadius: BrandRadius.buttonSubtle,
    sectionRadius: BrandRadius.buttonSubtle,
    minHeight: BrandSpacing.iconContainer,
    paddingHorizontal: BrandSpacing.componentPadding,
    separatorInset: BrandSpacing.sm + 2,
  },
  md: {
    railPadding: BrandSpacing.xs + 1,
    railRadius: BrandRadius.input,
    sectionRadius: BrandRadius.buttonSubtle,
    minHeight: BrandSpacing.iconContainer + 6,
    paddingHorizontal: BrandSpacing.lg,
    separatorInset: BrandSpacing.sm + 3,
  },
} as const;

const DISCLOSURE_LAYOUT = LinearTransition.duration(220).reduceMotion(ReduceMotion.System);

export function KitDisclosureButtonGroup<T extends string>({
  value,
  options,
  expanded,
  onChange,
  onToggleExpanded,
  showTriggerWhenExpanded = true,
  triggerLabel,
  triggerIcon,
  accessibilityLabel,
  size = "md",
  style,
  railColor,
  selectedColor,
  labelColor,
  selectedLabelColor,
  dividerColor,
}: KitDisclosureButtonGroupProps<T>) {
  const palette = useBrand();
  const metrics = SIZE_PRESETS[size];
  const resolvedRailColor = railColor ?? String(palette.primaryPressed);
  const resolvedSelectedColor = selectedColor ?? String(palette.primary);
  const resolvedLabelColor = labelColor ?? String(palette.onPrimary);
  const resolvedSelectedLabelColor = selectedLabelColor ?? String(palette.onPrimary);
  const resolvedDividerColor = dividerColor ?? String(palette.onPrimary);
  const isIconOnlyTrigger = !triggerLabel;

  return (
    <Animated.View
      layout={DISCLOSURE_LAYOUT}
      className="flex-row items-stretch overflow-hidden rounded-button-subtle"
      style={[
        {
          backgroundColor: resolvedRailColor,
          minHeight: metrics.minHeight,
          borderRadius: metrics.railRadius,
          padding: metrics.railPadding,
        },
        style,
      ]}
    >
      {expanded ? (
        <Animated.View layout={DISCLOSURE_LAYOUT} className="flex-row items-stretch">
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <View key={option.value} className="relative">
                {index > 0 ? (
                  <View
                    pointerEvents="none"
                    className="absolute"
                    style={[
                      {
                        left: 0,
                        width: StyleSheet.hairlineWidth,
                        top: metrics.separatorInset,
                        bottom: metrics.separatorInset,
                        backgroundColor: resolvedDividerColor,
                      },
                    ]}
                  />
                ) : null}
                {selected ? (
                  <View
                    pointerEvents="none"
                    className="absolute inset-0 rounded-button-subtle"
                    style={[
                      {
                        backgroundColor: resolvedSelectedColor,
                      },
                    ]}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={option.accessibilityLabel ?? option.label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    triggerSelectionHaptic();
                    onChange(option.value);
                  }}
                  className="relative z-10"
                  style={({ pressed }) => [
                    {
                      borderRadius: metrics.sectionRadius,
                      backgroundColor: pressed ? String(palette.primaryPressed) : undefined,
                    },
                  ]}
                >
                  <View
                    className="flex-row items-center justify-center rounded-button-subtle"
                    style={[
                      {
                        minHeight: metrics.minHeight,
                        paddingHorizontal: metrics.paddingHorizontal,
                      } satisfies ViewStyle,
                    ]}
                  >
                    {option.icon ? (
                      <View className="items-center justify-center">{option.icon}</View>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      className="text-center font-bold"
                      style={[
                        {
                          color: selected ? resolvedSelectedLabelColor : resolvedLabelColor,
                          ...BrandType.bodyMedium,
                          includeFontPadding: false,
                          textAlignVertical: "center" as const,
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
        </Animated.View>
      ) : null}

      <Animated.View
        layout={DISCLOSURE_LAYOUT}
        pointerEvents={expanded && !showTriggerWhenExpanded ? "none" : "auto"}
        style={
          expanded && !showTriggerWhenExpanded
            ? {
                width: 0,
                marginLeft: 0,
                marginRight: 0,
                overflow: "hidden",
              }
            : undefined
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded }}
          onPress={() => {
            triggerSelectionHaptic();
            onToggleExpanded();
          }}
          className="justify-center"
          style={({ pressed }) => [
            {
              borderRadius: metrics.sectionRadius,
              backgroundColor: pressed ? String(palette.primaryPressed) : undefined,
            },
          ]}
        >
          <View
            className="flex-row items-center justify-center rounded-button-subtle"
            style={[
              {
                minHeight: metrics.minHeight,
                ...(isIconOnlyTrigger
                  ? {
                      width: metrics.minHeight,
                    }
                  : {
                      paddingHorizontal: metrics.paddingHorizontal,
                    }),
              } satisfies ViewStyle,
            ]}
          >
            {triggerIcon ? (
              <View className="items-center justify-center">{triggerIcon}</View>
            ) : null}
            {triggerLabel ? (
              <Text className="font-bold" style={{ color: String(palette.onPrimary) }}>
                {triggerLabel}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
