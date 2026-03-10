import { ScrollView, Text } from "react-native";
import { HomeSurface } from "@/components/home/home-dashboard-layout";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";

type StatItem = {
  label: string;
  value: string;
};

type HomeStatsRowProps = {
  palette: BrandPalette;
  stats: StatItem[];
};

export function HomeStatsRow({ palette, stats }: HomeStatsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.xl }}
    >
      {stats.map((stat) => (
        <HomeSurface
          key={stat.label}
          palette={palette}
          style={{
            padding: BrandSpacing.lg,
            minWidth: 140,
            gap: BrandSpacing.xs,
          }}
        >
          <Text
            style={{
              ...BrandType.micro,
               color: palette.textMuted as string,
               textTransform: "uppercase",
            }}
          >
            {stat.label}
          </Text>
          <Text
            style={{
              ...BrandType.title,
              fontSize: 24,
              color: palette.text as string,
              fontVariant: ["tabular-nums"],
            }}
          >
            {stat.value}
          </Text>
        </HomeSurface>
      ))}
    </ScrollView>
  );
}
