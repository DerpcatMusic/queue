import type { ReactNode } from "react";
import { memo } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";

type StatusSignalTone = "surface" | "accent";

export type StatusSignalProps = {
  label: string;
  value: string;
  tone?: StatusSignalTone;
  icon?: ReactNode;
};

const STATUS_SIGNAL_MIN_HEIGHT = 44;
const STATUS_SIGNAL_HORIZONTAL_PADDING = BrandSpacing.controlX;
const STATUS_SIGNAL_VERTICAL_PADDING = BrandSpacing.controlY;
const STATUS_SIGNAL_CONTENT_GAP = 2;

export const StatusSignal = memo(function StatusSignal({
  label,
  value,
  tone = "surface",
  icon,
}: StatusSignalProps) {
  const { color: palette } = useTheme();
  const backgroundColor = tone === "accent" ? "#CCFF00" : palette.surfaceElevated;
  const labelColor = tone === "accent" ? "#161E00" : palette.textMuted;
  const valueColor = palette.text;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inner,
          {
            backgroundColor,
            borderRadius: BrandRadius.medium,
            borderCurve: "continuous",
          },
        ]}
      >
        <View style={styles.content}>
          <Text
            style={[
              styles.label,
              {
                fontFamily: "Manrope_500Medium",
                fontSize: 12,
                fontWeight: "500",
                letterSpacing: 0.2,
                lineHeight: 16,
                color: labelColor,
                textTransform: "uppercase",
              },
            ]}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.value,
              {
                fontFamily: "Manrope_600SemiBold",
                fontSize: 16,
                fontWeight: "600",
                lineHeight: 22,
                color: valueColor,
              },
            ]}
          >
            {value}
          </Text>
        </View>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: STATUS_SIGNAL_MIN_HEIGHT,
    paddingHorizontal: STATUS_SIGNAL_HORIZONTAL_PADDING,
    paddingVertical: STATUS_SIGNAL_VERTICAL_PADDING,
    gap: BrandSpacing.sm,
  },
  content: {
    flex: 1,
    gap: STATUS_SIGNAL_CONTENT_GAP,
    minWidth: 0,
  },
  label: {
    // textTransform: uppercase and letterSpacing applied inline
  },
  value: {
    // bodyStrong already has correct styling
  },
  iconSlot: {
    flexShrink: 0,
  },
});
