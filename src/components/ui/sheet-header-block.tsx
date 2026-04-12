import { I18nManager, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type SheetHeaderBlockProps = {
  title: string;
  subtitle?: string;
  progressCount?: number;
  progressIndex?: number;
  trailingLabel?: string;
  trailingIcon?: React.ReactNode;
  onPressTrailing?: () => void;
  tone?: "primary" | "surface";
  trailingTone?: "default" | "danger";
};

export function SheetHeaderBlock({
  title,
  subtitle,
  progressCount,
  progressIndex,
  trailingLabel,
  trailingIcon,
  onPressTrailing,
  tone = "surface",
  trailingTone = "default",
}: SheetHeaderBlockProps) {
  const theme = useTheme();
  const foregroundColor = tone === "primary" ? theme.color.onPrimary : theme.color.text;
  const inactiveProgress =
    tone === "primary" ? theme.color.primaryPressed : theme.color.surfaceMuted;
  const trailingBackgroundColor =
    trailingTone === "danger"
      ? theme.color.dangerSubtle
      : tone === "primary"
        ? theme.color.primaryPressed
        : theme.color.surfaceMuted;
  const trailingForegroundColor =
    trailingTone === "danger"
      ? theme.color.danger
      : tone === "primary"
        ? theme.color.onPrimary
        : theme.color.text;
  const subtitleColor = tone === "primary" ? theme.color.onPrimary : theme.color.textMuted;
  const pressedTrailingBackgroundColor =
    trailingTone === "danger"
      ? theme.color.danger
      : tone === "primary"
        ? theme.color.primary
        : theme.color.surfaceElevated;

  return (
    <View style={{ gap: BrandSpacing.md }}>
      <View
        style={{
          flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: BrandSpacing.md,
        }}
      >
        {progressCount && progressIndex ? (
          <View
            style={{
              flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
              alignItems: "center",
              gap: BrandSpacing.sm,
            }}
          >
            {Array.from({ length: progressCount }, (_, index) => {
              const isActive = index < progressIndex;
              const isCurrent = index + 1 === progressIndex;
              const stepId = `step-${index}`;
              return (
                <View
                  key={stepId}
                  style={{
                    width: isCurrent
                      ? BrandSpacing.progressPillActive
                      : BrandSpacing.progressPillInactive,
                    height: BrandSpacing.sm,
                    borderRadius: BrandRadius.pill,
                    backgroundColor: (isActive ? foregroundColor : inactiveProgress) as string,
                  }}
                />
              );
            })}
          </View>
        ) : (
          <View />
        )}

        {trailingLabel && onPressTrailing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={trailingLabel}
            onPress={onPressTrailing}
            style={({ pressed }) => [
              {
                borderRadius: BrandRadius.buttonSubtle,
                borderCurve: "continuous",
                backgroundColor: pressed ? pressedTrailingBackgroundColor : trailingBackgroundColor,
              },
            ]}
          >
            <View
              style={{
                flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "center",
                gap: BrandSpacing.xs,
                minHeight: BrandSpacing.controlMd,
                borderCurve: "continuous",
                borderRadius: BrandRadius.medium,
                backgroundColor: trailingBackgroundColor,
                paddingHorizontal: BrandSpacing.controlX,
                paddingVertical: BrandSpacing.sm,
              }}
            >
              {trailingIcon}
              <ThemedText type="bodyMedium" style={{ color: trailingForegroundColor as string }}>
                {trailingLabel}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: BrandSpacing.xs }}>
        <ThemedText type="title" style={{ color: foregroundColor as string }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="caption" style={{ color: subtitleColor as string }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
