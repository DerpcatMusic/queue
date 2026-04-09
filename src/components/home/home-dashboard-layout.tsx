import type { PropsWithChildren } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
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

type HomeSurfaceTone = "surface" | "alt" | "primary";

const surfaceStyles = StyleSheet.create((theme) => ({
  base: {
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    borderWidth: 0,
    borderColor: "transparent",
  },
  tone_surface: {
    backgroundColor: theme.color.surface,
    ...theme.shadow.card,
  },
  tone_alt: {
    backgroundColor: theme.color.surfaceAlt,
    ...theme.shadow.card,
  },
  tone_primary: {
    backgroundColor: theme.color.primarySubtle,
    ...theme.shadow.card,
  },
}));

export function HomeSurface({
  children,
  tone = "surface",
  style,
}: PropsWithChildren<{
  tone?: HomeSurfaceTone;
  style?: StyleProp<ViewStyle>;
}>) {
  return <Box style={[surfaceStyles.base, surfaceStyles[`tone_${tone}`], style]}>{children}</Box>;
}

const headingStyles = StyleSheet.create((theme) => ({
  eyebrow: {
    ...BrandType.microItalic,
    color: theme.color.textMuted,
  },
  title: {
    ...BrandType.headingItalic,
    fontSize: 14,
    color: theme.color.primary,
    transform: [{ skewX: "-6deg" }],
  },
}));

export function HomeSectionHeading({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <Box style={{ gap: BrandSpacing.xs }}>
      {eyebrow ? <Text style={headingStyles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={headingStyles.title}>{title.toUpperCase()}</Text>
    </Box>
  );
}
