import { I18nManager, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
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
  const mutedColor = tone === "primary" ? palette.onPrimary : palette.textMuted;
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
              return (
                <View
                  key={`progress-${index + 1}`}
                  style={{
                    width: isCurrent ? 28 : 18,
                    height: 8,
                    borderRadius: BrandRadius.pill,
                    backgroundColor: (isActive ? foregroundColor : inactiveProgress) as string,
                    opacity: isCurrent ? 1 : isActive ? 0.82 : 0.48,
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
            style={({ pressed }) => ({
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View
              style={{
                minHeight: 42,
                borderRadius: BrandRadius.button - 2,
                borderCurve: "continuous",
                backgroundColor: trailingBackgroundColor,
                paddingHorizontal: 14,
                paddingVertical: 9,
                flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
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

      <View style={{ gap: 6 }}>
        <ThemedText type="title" style={{ color: foregroundColor as string }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="caption" style={{ color: mutedColor as string, opacity: 0.84 }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
