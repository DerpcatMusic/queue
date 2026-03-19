import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { ChoicePill } from "@/components/ui/choice-pill";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";

type MapSelectedZonesStripProps = {
  selectedZones: ZoneOption[];
  focusZoneId: string | null;
  zoneLanguage: "en" | "he";
  palette: BrandPalette;
  onPressZone: (zoneId: string) => void;
};

export function MapSelectedZonesStrip({
  selectedZones,
  focusZoneId,
  zoneLanguage,
  palette,
  onPressZone,
}: MapSelectedZonesStripProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: BrandSpacing.sm,
        paddingTop: BrandSpacing.sm,
        paddingBottom: BrandSpacing.xs,
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
              onPress={() => onPressZone(zone.id)}
              style={{
                minHeight: BrandSpacing.xl + BrandSpacing.sm,
                paddingHorizontal: BrandSpacing.lg - BrandSpacing.xs,
                paddingVertical: BrandSpacing.sm - 2,
                width: undefined,
              }}
            />
          );
        })
      ) : (
        <View
          style={{
            minHeight: BrandSpacing.xl + BrandSpacing.sm,
            borderRadius: BrandRadius.pill,
            borderCurve: "continuous",
            paddingHorizontal: BrandSpacing.lg - BrandSpacing.xs,
            paddingVertical: BrandSpacing.sm - 2,
            borderWidth: 1,
            borderColor: palette.borderStrong as string,
            backgroundColor: palette.surfaceElevated as string,
            justifyContent: "center",
          }}
        >
          <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
            {t("mapTab.mobile.emptySelection")}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
