import { I18nManager, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

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
  const palette = useBrand();
  const foregroundColor = tone === "primary" ? palette.onPrimary : palette.text;
  const inactiveProgress = tone === "primary" ? palette.primaryPressed : palette.surfaceAlt;
  const trailingBackgroundColor =
    trailingTone === "danger"
      ? (palette.dangerSubtle as string)
      : tone === "primary"
        ? (palette.primaryPressed as string)
        : (palette.surfaceAlt as string);
  const trailingForegroundColor =
    trailingTone === "danger"
      ? (palette.danger as string)
      : tone === "primary"
        ? (palette.onPrimary as string)
        : (palette.text as string);
  const subtitleColor = tone === "primary" ? palette.onPrimary : palette.textMuted;
  const pressedTrailingBackgroundColor =
    trailingTone === "danger"
      ? (palette.danger as string)
      : tone === "primary"
        ? (palette.primary as string)
        : (palette.surfaceElevated as string);

  return (
    <View className="gap-md">
      <View
        className="items-center justify-between gap-md"
        style={{
          flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
        }}
      >
        {progressCount && progressIndex ? (
          <View
            className="items-center gap-sm"
            style={{
              flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
            }}
          >
            {Array.from({ length: progressCount }, (_, index) => {
              const isActive = index < progressIndex;
              const isCurrent = index + 1 === progressIndex;
              return (
                <View
                  key={`progress-${index + 1}`}
                  className="rounded-pill"
                  style={{
                    width: isCurrent ? 28 : 18,
                    height: 8,
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
                borderRadius: BrandSpacing.lg,
                borderCurve: "continuous",
                backgroundColor: pressed ? pressedTrailingBackgroundColor : trailingBackgroundColor,
              },
            ]}
          >
            <View
              className="flex-row items-center justify-center gap-xs rounded-medium"
              style={{
                minHeight: BrandSpacing.controlMd,
                borderCurve: "continuous",
                backgroundColor: trailingBackgroundColor,
                paddingHorizontal: BrandSpacing.controlX,
                paddingVertical: BrandSpacing.sm,
                flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
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

      <View className="gap-xs">
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
