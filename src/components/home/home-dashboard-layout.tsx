import type { PropsWithChildren } from "react";
import { type StyleProp, Text, View, type ViewStyle } from "react-native";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";

export function useHomeDashboardLayout() {
  const { isDesktopWeb: isWideWeb, isExpandedWeb } = useLayoutBreakpoint();

  return {
    isWideWeb,
    isExpandedWeb,
    sectionGap: BrandSpacing.xl,
    topRowGap: BrandSpacing.xl,
    chartFlex: isWideWeb ? 1.18 : 1,
    heroFlex: isWideWeb ? 0.82 : 1,
    actionColumnWidth: isWideWeb ? 170 : undefined,
    railMinHeight: isExpandedWeb ? 520 : isWideWeb ? 460 : undefined,
  };
}

type HomeSurfaceProps = PropsWithChildren<{
  tone?: "surface" | "alt" | "primary";
  style?: StyleProp<ViewStyle>;
}>;

export function HomeSurface({ children, tone = "alt", style }: HomeSurfaceProps) {
  const { color: palette } = useTheme();
  const backgroundColor =
    tone === "primary"
      ? palette.primary
      : tone === "surface"
        ? palette.surface
        : palette.surfaceAlt;

  return (
    <View
      style={[
        {
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function HomeSectionHeading({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const { color: palette } = useTheme();
  return (
    <View style={{ gap: BrandSpacing.xs }}>
      {eyebrow ? (
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            fontSize: 12,
            fontWeight: "500",
            letterSpacing: 0.2,
            lineHeight: 16,
            color: palette.textMuted,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: "Lexend_600SemiBold",
          fontSize: 28,
          fontWeight: "600",
          letterSpacing: -0.45,
          lineHeight: 34,
          color: palette.text,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
