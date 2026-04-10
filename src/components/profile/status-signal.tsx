import type { ReactNode } from "react";
import { memo } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
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
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inner(tone),
          {
            borderRadius: BrandRadius.medium,
            borderCurve: "continuous",
          },
        ]}
      >
        <View style={styles.content}>
          <Text
            style={[
              styles.label(tone),
              {
                fontFamily: "Manrope_500Medium",
                fontSize: 12,
                fontWeight: "500",
                letterSpacing: 0.2,
                lineHeight: 16,
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

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    minWidth: 0,
  },
  inner: (tone: StatusSignalTone) => ({
    flexDirection: "row",
    alignItems: "center",
    minHeight: STATUS_SIGNAL_MIN_HEIGHT,
    paddingHorizontal: STATUS_SIGNAL_HORIZONTAL_PADDING,
    paddingVertical: STATUS_SIGNAL_VERTICAL_PADDING,
    gap: BrandSpacing.sm,
    backgroundColor: tone === "accent" ? theme.color.primary : theme.color.surfaceElevated,
  }),
  content: {
    flex: 1,
    gap: STATUS_SIGNAL_CONTENT_GAP,
    minWidth: 0,
  },
  label: (tone: StatusSignalTone) => ({
    color: tone === "accent" ? theme.color.onPrimary : theme.color.textMuted,
  }),
  value: {
    color: theme.color.text,
  },
  iconSlot: {
    flexShrink: 0,
  },
}));
