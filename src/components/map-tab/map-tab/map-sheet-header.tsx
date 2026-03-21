import type { TFunction } from "i18next";
import { View } from "react-native";

import { MapSelectedZonesStrip } from "@/components/map-tab/map/map-selected-zones-strip";
import { NativeSearchField } from "@/components/ui/native-search-field";
import type { BrandPalette } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";

type MapSheetHeaderProps = {
  focusZoneId: string | null;
  onChangeSearch: (text: string) => void;
  onFocusSearch: () => void;
  palette: BrandPalette;
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
  selectedZones,
  onPressZone,
  t,
  zoneLanguage,
  zoneSearch,
}: MapSheetHeaderProps) {
  return (
    <View style={{ gap: 6 }}>
      <NativeSearchField
        value={zoneSearch}
        onChangeText={onChangeSearch}
        onFocus={onFocusSearch}
        placeholder={t("mapTab.searchPlaceholder")}
        clearAccessibilityLabel={t("common.clear")}
      />
      <MapSelectedZonesStrip
        selectedZones={selectedZones}
        focusZoneId={focusZoneId}
        zoneLanguage={zoneLanguage}
        palette={palette}
        onPressZone={onPressZone}
      />
    </View>
  );
}
