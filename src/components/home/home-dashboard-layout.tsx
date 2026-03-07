import type { PropsWithChildren } from "react";
import { type StyleProp, Text, useWindowDimensions, View, type ViewStyle } from "react-native";

import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

const HOME_WIDE_BREAKPOINT = 1180;
const HOME_EXPANDED_BREAKPOINT = 1380;

export function useHomeDashboardLayout() {
  const { width } = useWindowDimensions();
  const isWideWeb = process.env.EXPO_OS === "web" && width >= HOME_WIDE_BREAKPOINT;
  const isExpandedWeb = process.env.EXPO_OS === "web" && width >= HOME_EXPANDED_BREAKPOINT;

  return {
    isWideWeb,
    isExpandedWeb,
    sectionGap: isWideWeb ? BrandSpacing.xl + 4 : BrandSpacing.xl,
    topRowGap: isWideWeb ? 20 : BrandSpacing.xl,
    chartFlex: isWideWeb ? 1.18 : 1,
    heroFlex: isWideWeb ? 0.82 : 1,
    actionColumnWidth: isWideWeb ? 170 : undefined,
    railMinHeight: isExpandedWeb ? 520 : isWideWeb ? 460 : undefined,
  };
}

type HomeSurfaceProps = PropsWithChildren<{
  palette: BrandPalette;
  tone?: "surface" | "alt" | "primary";
  style?: StyleProp<ViewStyle>;
}>;

export function HomeSurface({ children, palette, tone = "alt", style }: HomeSurfaceProps) {
  const backgroundColor =
    tone === "primary"
      ? (palette.primary as string)
      : tone === "surface"
        ? (palette.surface as string)
        : (palette.surfaceAlt as string);

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

export function HomeSectionHeading({
  title,
  palette,
  eyebrow,
}: {
  title: string;
  palette: BrandPalette;
  eyebrow?: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      {eyebrow ? (
        <Text
          style={{
            ...BrandType.micro,
            color: palette.textMuted as string,
            letterSpacing: 0.6,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text style={{ ...BrandType.heading, fontSize: 26, color: palette.text as string }}>
        {title}
      </Text>
    </View>
  );
}
