import type { TFunction } from "i18next";
import { View } from "react-native";

import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin } from "@/components/maps/queue-map.types";
import { type BrandPalette, BrandRadius, BrandSpacing } from "@/constants/brand";
import type { ZoneOption } from "@/constants/zones";
import { MapWebCommandPanel } from "./map-web-command-panel";
import { MapWebHeaderPanels } from "./map-web-header-panels";

type MapWebWorkbenchProps = {
  t: TFunction;
  palette: BrandPalette;
  zoneLanguage: "en" | "he";
  zoneSearch: string;
  selectedZones: ZoneOption[];
  filteredZones: ZoneOption[];
  focusZoneId: string | null;
  focusedZoneLabel: string | null;
  mapPin: QueueMapPin | null;
  hasChanges: boolean;
  pendingChangeCount: number;
  persistedZoneCount: number;
  isSaving: boolean;
  saveError: string | null;
  onToggleZone: (zoneId: string) => void;
  onSetFocusZone: (zoneId: string | null) => void;
  onHandleFocusSelection: () => void;
  onHandleSaveZones: () => void;
  onHandleDiscardChanges: () => void;
  onSearchChange: (text: string) => void;
};

export function MapWebWorkbench({
  t,
  palette,
  zoneLanguage,
  zoneSearch,
  selectedZones,
  filteredZones,
  focusZoneId,
  focusedZoneLabel,
  mapPin,
  hasChanges,
  pendingChangeCount,
  persistedZoneCount,
  isSaving,
  saveError,
  onToggleZone,
  onSetFocusZone,
  onHandleFocusSelection,
  onHandleSaveZones,
  onHandleDiscardChanges,
  onSearchChange,
}: MapWebWorkbenchProps) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: BrandSpacing.xl,
        paddingTop: BrandSpacing.xl,
        paddingBottom: BrandSpacing.xl,
        gap: BrandSpacing.lg,
      }}
    >
      <MapWebHeaderPanels
        t={t}
        palette={palette}
        hasChanges={hasChanges}
        pendingChangeCount={pendingChangeCount}
        persistedZoneCount={persistedZoneCount}
        focusedZoneLabel={focusedZoneLabel}
        isSaving={isSaving}
        onSave={onHandleSaveZones}
        onReset={onHandleDiscardChanges}
      />

      <View style={{ flex: 1, minHeight: 0, flexDirection: "row", gap: BrandSpacing.lg }}>
        <View
          style={{
            flex: 1.45,
            minWidth: 0,
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: palette.surfaceAlt as string,
          }}
        >
          <QueueMap
            mode="zoneSelect"
            pin={mapPin}
            selectedZoneIds={selectedZones.map((zone) => zone.id)}
            focusZoneId={focusZoneId}
            onPressZone={onToggleZone}
            onPressMap={() => {}}
            onUseGps={onHandleFocusSelection}
            showGpsButton={false}
          />
        </View>

        <MapWebCommandPanel
          t={t}
          palette={palette}
          zoneLanguage={zoneLanguage}
          zoneSearch={zoneSearch}
          selectedZones={selectedZones}
          filteredZones={filteredZones}
          focusZoneId={focusZoneId}
          focusedZoneLabel={focusedZoneLabel}
          pendingChangeCount={pendingChangeCount}
          saveError={saveError}
          onSearchChange={onSearchChange}
          onSetFocusZone={onSetFocusZone}
          onToggleZone={onToggleZone}
        />
      </View>
    </View>
  );
}
