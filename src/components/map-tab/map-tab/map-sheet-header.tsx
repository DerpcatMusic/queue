import type { TFunction } from "i18next";
import { View } from "react-native";

import { MapSelectedZonesStrip } from "@/components/map-tab/map/map-selected-zones-strip";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, type getMapBrandPalette } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";

type MapSheetHeaderProps = {
  focusZoneId?: string | null;
  onChangeSearch?: (text: string) => void;
  onFocusSearch?: () => void;
  mapPalette?: ReturnType<typeof getMapBrandPalette>;
  selectedZones?: ZoneOption[];
  onPressZone?: (zoneId: string) => void;
  t?: TFunction;
  zoneLanguage?: "en" | "he";
  zoneSearch?: string;
};

export function MapSheetHeader({
  focusZoneId: focusZoneIdProp,
  onChangeSearch: onChangeSearchProp,
  onFocusSearch: _onFocusSearch,
  mapPalette: mapPaletteProp,
  selectedZones: selectedZonesProp,
  onPressZone: onPressZoneProp,
  t: tProp,
  zoneLanguage: zoneLanguageProp,
  zoneSearch: zoneSearchProp,
}: MapSheetHeaderProps) {
  const focusZoneId = focusZoneIdProp ?? null;
  const selectedZones = selectedZonesProp ?? [];
  const onPressZone = onPressZoneProp;
  const zoneSearch = zoneSearchProp ?? "";

  return (
    <View style={{ gap: BrandSpacing.xs }}>
      {onChangeSearchProp && mapPaletteProp && tProp && (
        <NativeSearchField
          value={zoneSearch}
          onChangeText={onChangeSearchProp}
          onFocus={_onFocusSearch}
          placeholder={tProp("mapTab.searchPlaceholder")}
          clearAccessibilityLabel={tProp("common.clear")}
          size="sm"
          containerStyle={{ backgroundColor: mapPaletteProp.surfaceAlt }}
        />
      )}
      <MapSelectedZonesStrip
        selectedZones={selectedZones}
        focusZoneId={focusZoneId}
        zoneLanguage={zoneLanguageProp ?? "en"}
        onPressZone={onPressZone ?? (() => {})}
      />
    </View>
  );
}
