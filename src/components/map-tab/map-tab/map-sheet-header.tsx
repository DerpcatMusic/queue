import type { TFunction } from "i18next";
import { View } from "react-native";

import { MapSelectedZonesStrip } from "@/components/map-tab/map/map-selected-zones-strip";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { type BrandPalette, BrandSpacing, type getMapBrandPalette } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";

type MapSheetHeaderProps = {
  focusZoneId: string | null;
  onChangeSearch: (text: string) => void;
  onFocusSearch: () => void;
  palette: BrandPalette;
  mapPalette: ReturnType<typeof getMapBrandPalette>;
  selectedZones: ZoneOption[];
  onPressZone: (zoneId: string | null) => void;
  t: TFunction;
  zoneLanguage: "en" | "he";
  zoneSearch: string;
};

export function MapSheetHeader({
  focusZoneId,
  onChangeSearch,
  onFocusSearch,
  palette,
  mapPalette: _mapPalette,
  selectedZones,
  onPressZone,
  t,
  zoneLanguage,
  zoneSearch,
}: MapSheetHeaderProps) {
  return (
    <View style={{ gap: BrandSpacing.xs }}>
      <NativeSearchField
        value={zoneSearch}
        onChangeText={onChangeSearch}
        onFocus={onFocusSearch}
        placeholder={t("mapTab.searchPlaceholder")}
        clearAccessibilityLabel={t("common.clear")}
        size="sm"
        containerStyle={{ backgroundColor: palette.surfaceAlt as string }}
      />
      <MapSelectedZonesStrip
        selectedZones={selectedZones}
        focusZoneId={focusZoneId}
        zoneLanguage={zoneLanguage}
        palette={palette}
        mapPalette={_mapPalette}
        onPressZone={onPressZone}
      />
    </View>
  );
}
