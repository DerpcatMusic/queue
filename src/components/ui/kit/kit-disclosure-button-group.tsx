import type { ReactNode } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInRight,
  FadeOutRight,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

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
    railRadius: BrandRadius.cardSubtle,
    sectionRadius: BrandRadius.buttonSubtle,
    minHeight: BrandSpacing.iconContainer,
    paddingHorizontal: BrandSpacing.componentPadding,
    separatorInset: BrandSpacing.sm + 2,
  },
  md: {
    railPadding: BrandSpacing.xs + 1,
    railRadius: BrandRadius.cardSubtle + 2,
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
  const resolvedRailColor = railColor ?? `${String(palette.text)}CC`;
  const resolvedSelectedColor = selectedColor ?? `${String(palette.onPrimary)}33`;
  const resolvedLabelColor = labelColor ?? `${String(palette.onPrimary)}B8`;
  const resolvedSelectedLabelColor = selectedLabelColor ?? String(palette.onPrimary);
  const resolvedDividerColor = dividerColor ?? `${String(palette.onPrimary)}1F`;

  return (
    <Animated.View
      layout={DISCLOSURE_LAYOUT}
      className="overflow-hidden"
      style={[
        styles.rail,
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
        <Animated.View
          layout={DISCLOSURE_LAYOUT}
          entering={FadeInRight.duration(180)}
          exiting={FadeOutRight.duration(140)}
          className="flex-row items-stretch"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <View key={option.value} style={styles.segmentWrap}>
                {index > 0 ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.divider,
                      {
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
                    style={[
                      styles.selectionFill,
                      {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        borderRadius: metrics.sectionRadius,
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
                  style={({ pressed }) => [styles.segmentButton, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View
                    className="flex-row items-center justify-center"
                    style={[
                      {
                        minHeight: metrics.minHeight,
                        paddingHorizontal: metrics.paddingHorizontal,
                      } satisfies ViewStyle,
                    ]}
                  >
                    {option.icon ? <View style={styles.iconWrap}>{option.icon}</View> : null}
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.segmentLabel,
                        {
                          color: selected ? resolvedSelectedLabelColor : resolvedLabelColor,
                        } satisfies TextStyle,
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
        onPress={() => {
          triggerSelectionHaptic();
          onToggleExpanded();
        }}
        style={({ pressed }) => [
          styles.segmentWrap,
          styles.triggerPressable,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <View
          className="flex-row items-center justify-center"
          style={[
            styles.triggerButton,
            {
              minHeight: metrics.minHeight,
              paddingHorizontal: triggerLabel ? metrics.paddingHorizontal : BrandSpacing.md,
              borderRadius: metrics.sectionRadius,
            } satisfies ViewStyle,
          ]}
        >
          {triggerIcon ? <View style={styles.iconWrap}>{triggerIcon}</View> : null}
          {triggerLabel ? (
            <Text style={[styles.segmentLabel, { color: String(palette.onPrimary) }]}>
              {triggerLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  segmentWrap: {
    position: "relative",
  },
  divider: {
    position: "absolute",
    left: 0,
    width: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
  selectionFill: {
    position: "absolute",
  },
  segmentButton: {
    position: "relative",
    zIndex: 1,
  },
  segmentContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.xs + 2,
  },
  triggerPressable: {
    justifyContent: "center",
  },
  triggerButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: BrandSpacing.xs + 2,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    ...BrandType.bodyMedium,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
