import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

type ZoneStudioSummaryProps = {
  zoneLabel: string;
  count: number;
};

const MAX_DOTS = 6;

export function ZoneStudioSummary({ zoneLabel, count }: ZoneStudioSummaryProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const previewCount = Math.min(count, MAX_DOTS);
  const extraCount = Math.max(0, count - MAX_DOTS);

  return (
    <KitSurface tone="sheet" style={{ minWidth: 180, gap: BrandSpacing.sm }}>
      <Box style={{ gap: BrandSpacing.xxs }}>
        <ThemedText type="micro" style={{ color: color.textMuted }}>
          {t("mapTab.mobile.zoneStudioSummaryTitle", { defaultValue: "Zone selection" })}
        </ThemedText>
        <ThemedText type="cardTitle" numberOfLines={1}>
          {zoneLabel}
        </ThemedText>
      </Box>

      <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
          {Array.from({ length: previewCount }).map((_, index) => (
            <Box
              key={`zone-studio-dot-${String(index)}`}
              style={{
                width: BrandSpacing.statusDotBadge,
                height: BrandSpacing.statusDotBadge,
                borderRadius: BrandRadius.full,
                backgroundColor: color.primary,
                opacity: 0.92 - index * 0.08,
              }}
            />
          ))}
          {extraCount > 0 ? (
            <ThemedText type="meta" style={{ color: color.textMuted }}>
              +{String(extraCount)}
            </ThemedText>
          ) : null}
        </Box>
        <ThemedText type="meta" style={{ color: color.textMuted, flexShrink: 1 }}>
          {count === 1
            ? t("mapTab.mobile.zoneStudioSummaryCountSingle", {
                defaultValue: "1 studio inside this zone",
              })
            : t("mapTab.mobile.zoneStudioSummaryCountMany", {
                count,
                defaultValue: "{{count}} studios inside this zone",
              })}
        </ThemedText>
      </Box>
    </KitSurface>
  );
}
