import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { HomeSurface, useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";

type StatItem = {
  icon: ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
};

type HomeStatsRowProps = {
  palette: BrandPalette;
  stats: StatItem[];
};

export function HomeStatsRow({ palette, stats }: HomeStatsRowProps) {
  const layout = useHomeDashboardLayout();

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: BrandSpacing.sm,
      }}
    >
      {stats.map((stat) => (
        <View
          key={stat.label}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}`}
          style={{
            minWidth: layout.isWideWeb ? 0 : 140,
            flexBasis: layout.isWideWeb ? 0 : 140,
            flexGrow: 1,
          }}
        >
          <HomeSurface
            palette={palette}
            style={{
              padding: BrandSpacing.lg,
              gap: BrandSpacing.xs,
              minHeight: 108,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol name={stat.icon} size={16} color={palette.textMuted as string} />
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted as string,
                  textTransform: "uppercase",
                  flexShrink: 1,
                }}
              >
                {stat.label}
              </Text>
            </View>
            <Text
              style={{
                ...BrandType.title,
                fontSize: 24,
                color: palette.text as string,
                fontVariant: ["tabular-nums"],
              }}
              numberOfLines={1}
            >
              {stat.value}
            </Text>
          </HomeSurface>
        </View>
      ))}
    </View>
  );
}
