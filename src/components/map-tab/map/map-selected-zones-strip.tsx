import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { ChoicePill } from "@/components/ui/choice-pill";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";
import { useTheme } from "@/hooks/use-theme";

const COMPACT_ZONE_PILL_MIN_HEIGHT = BrandSpacing.controlSm - BrandSpacing.xs;
const COMPACT_ZONE_PILL_RADIUS = BrandRadius.cardSubtle - BrandSpacing.sm;

type MapSelectedZonesStripProps = {
  selectedZones: ZoneOption[];
  focusZoneId: string | null;
  zoneLanguage: "en" | "he";
  onPressZone: (zoneId: string) => void;
};

export function MapSelectedZonesStrip({
  selectedZones,
  focusZoneId,
  zoneLanguage,
  onPressZone,
}: MapSelectedZonesStripProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: BrandSpacing.xs,
        paddingTop: 0,
        paddingBottom: 0,
        paddingRight: BrandSpacing.lg,
        alignItems: "center",
      }}
    >
      {selectedZones.length > 0 ? (
        selectedZones.map((zone) => {
          const isFocused = focusZoneId === zone.id;
          return (
            <ChoicePill
              key={zone.id}
              label={zone.label[zoneLanguage]}
              selected={isFocused}
              compact
              fullWidth={false}
              onPress={() => onPressZone(zone.id)}
              backgroundColor={palette.surfaceAlt}
              selectedBackgroundColor={palette.primarySubtle}
              labelColor={palette.text}
              selectedLabelColor={palette.primary}
              style={{
                minHeight: COMPACT_ZONE_PILL_MIN_HEIGHT,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.xs,
              }}
            />
          );
        })
      ) : (
        <View
          style={{
            minHeight: COMPACT_ZONE_PILL_MIN_HEIGHT,
            borderRadius: COMPACT_ZONE_PILL_RADIUS,
            borderCurve: "continuous",
            paddingHorizontal: BrandSpacing.md,
            paddingVertical: BrandSpacing.xs,
            backgroundColor: palette.surfaceAlt,
            justifyContent: "center",
          }}
        >
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
            {t("mapTab.mobile.emptySelection")}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
