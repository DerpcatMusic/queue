import type { PropsWithChildren } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";

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

export function HomeSurface({ children, tone = "surface", style }: HomeSurfaceProps) {
  const theme = useTheme();
  const { color: palette } = theme;
  const isLight = theme.scheme === "light";
  const backgroundColor =
    tone === "primary"
      ? isLight
        ? palette.primarySubtle
        : palette.primary
      : tone === "surface"
        ? palette.surface
        : palette.surfaceAlt;

  return (
    <Box
      style={[
        {
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor,
          borderWidth: 0,
          borderColor: "transparent",
          shadowColor: isLight ? palette.shadow : "transparent",
          shadowOpacity: isLight ? 1 : 0,
          shadowRadius: isLight ? 16 : 0,
          shadowOffset: isLight ? { width: 0, height: 10 } : { width: 0, height: 0 },
          elevation: isLight ? 0 : 0,
        },
        style,
      ]}
    >
      {children}
    </Box>
  );
}

export function HomeSectionHeading({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const { color: palette } = useTheme();
  return (
    <Box style={{ gap: BrandSpacing.xs }}>
      {eyebrow ? (
        <Text
          style={{
            ...BrandType.microItalic,
            color: palette.textMuted,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={{
          ...BrandType.headingItalic,
          fontSize: 14,
          color: palette.primary,
          transform: [{ skewX: "-6deg" }],
        }}
      >
        {title.toUpperCase()}
      </Text>
    </Box>
  );
}
