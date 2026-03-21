import type { ReactNode } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInRight,
  FadeOutRight,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

import { BrandType } from "@/constants/brand";
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
    railPadding: 4,
    railRadius: 16,
    sectionRadius: 12,
    minHeight: 40,
    paddingHorizontal: 14,
    separatorInset: 10,
  },
  md: {
    railPadding: 5,
    railRadius: 18,
    sectionRadius: 14,
    minHeight: 44,
    paddingHorizontal: 16,
    separatorInset: 11,
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
  const resolvedRailColor = railColor ?? "rgba(24, 14, 46, 0.66)";
  const resolvedSelectedColor = selectedColor ?? "rgba(255, 255, 255, 0.18)";
  const resolvedLabelColor = labelColor ?? "rgba(255, 255, 255, 0.72)";
  const resolvedSelectedLabelColor = selectedLabelColor ?? (palette.onPrimary as string);
  const resolvedDividerColor = dividerColor ?? "rgba(255, 255, 255, 0.12)";

  return (
    <Animated.View
      layout={DISCLOSURE_LAYOUT}
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
          style={styles.optionsRow}
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
                      { backgroundColor: "rgba(255, 255, 255, 0.12)" },
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
                    style={[
                      styles.segmentContent,
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
          style={[
            styles.triggerButton,
            {
              minHeight: metrics.minHeight,
              paddingHorizontal: triggerLabel ? metrics.paddingHorizontal : 12,
              borderRadius: metrics.sectionRadius,
            } satisfies ViewStyle,
          ]}
        >
          {triggerIcon ? <View style={styles.iconWrap}>{triggerIcon}</View> : null}
          {triggerLabel ? (
            <Text style={[styles.segmentLabel, { color: palette.onPrimary as string }]}>
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
    gap: 6,
  },
  triggerPressable: {
    justifyContent: "center",
  },
  triggerButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    ...BrandType.bodyMedium,
    fontSize: 15,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
