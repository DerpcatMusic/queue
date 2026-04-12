import type { TFunction } from "i18next";
import { MapSelectedZonesStrip } from "@/components/map-tab/map/map-selected-zones-strip";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, type getMapBrandPalette } from "@/constants/brand";
import type { SelectableBoundary } from "@/features/maps/boundaries/catalog";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

type MapSheetHeaderProps = {
  focusZoneId?: string | null;
  onChangeSearch?: (text: string) => void;
  onFocusSearch?: () => void;
  mapPalette?: ReturnType<typeof getMapBrandPalette>;
  selectedZones?: SelectableBoundary[];
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
  const { color: palette } = useTheme();
  const focusZoneId = focusZoneIdProp ?? null;
  const selectedZones = selectedZonesProp ?? [];
  const onPressZone = onPressZoneProp;
  const zoneSearch = zoneSearchProp ?? "";

  return (
    <Box style={{ gap: BrandSpacing.xs }}>
      {onChangeSearchProp && mapPaletteProp && tProp && (
        <NativeSearchField
          value={zoneSearch}
          onChangeText={onChangeSearchProp}
          onFocus={_onFocusSearch}
          placeholder={tProp("mapTab.searchPlaceholder")}
          clearAccessibilityLabel={tProp("common.clear")}
          size="sm"
          containerStyle={{ backgroundColor: palette.surfaceMuted }}
        />
      )}
      <MapSelectedZonesStrip
        selectedZones={selectedZones}
        focusZoneId={focusZoneId}
        zoneLanguage={zoneLanguageProp ?? "en"}
        onPressZone={onPressZone ?? (() => {})}
      />
    </Box>
  );
}
