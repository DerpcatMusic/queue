import { Redirect } from "expo-router";
import { Platform, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { MapMobileStage } from "@/components/map-tab/map-tab/map-mobile-stage";
import { MapWebWorkbench } from "@/components/map-tab/map-tab/map-web-workbench";
import { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";

export default function MapTabScreen() {
  const {
    currentUser,
    filteredZones,
    focusZoneId,
    focusedZoneLabel,
    handleDiscardChanges,
    handleEditButtonPress,
    handleFocusSelection,
    handleMapSheetSearchChange,
    handleMapUtilityPress,
    handleSaveZones,
    hasChanges,
    isFocused,
    isMapBodyReady,
    isSaving,
    mapCameraPadding,
    mapPalette,
    mapPin,
    noopMapPress,
    overlayBottom,
    palette,
    pendingChangeCount,
    persistedZoneIds,
    remoteZones,
    saveError,
    selectedZoneIds,
    selectedZones,
    setFocusZoneId,
    t,
    toggleZone,
    zoneLanguage,
    zoneSearch,
    zoneModeActive,
  } = useMapTabController();

  if (currentUser === undefined) {
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="sheet"
        style={{ backgroundColor: mapPalette.styleBackground }}
      >
        <View style={{ flex: 1, backgroundColor: mapPalette.styleBackground }} />
      </TabScreenRoot>
    );
  }

  if (!currentUser) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/studio" />;
  }

  if (!isMapBodyReady || remoteZones === undefined) {
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="sheet"
        style={{ backgroundColor: mapPalette.styleBackground }}
      >
        <View style={{ flex: 1, backgroundColor: mapPalette.styleBackground }} />
      </TabScreenRoot>
    );
  }

  if (Platform.OS === "web") {
    return (
      <TabScreenRoot
        mode="static"
        style={{ backgroundColor: palette.surface as string }}
        topInsetTone="card"
      >
        <MapWebWorkbench
          t={t}
          palette={palette}
          zoneLanguage={zoneLanguage}
          zoneSearch={zoneSearch}
          selectedZones={selectedZones}
          filteredZones={filteredZones}
          focusZoneId={focusZoneId}
          focusedZoneLabel={focusedZoneLabel}
          mapPin={mapPin}
          hasChanges={hasChanges}
          pendingChangeCount={pendingChangeCount}
          persistedZoneCount={persistedZoneIds.length}
          isSaving={isSaving}
          saveError={saveError}
          onToggleZone={toggleZone}
          onSetFocusZone={setFocusZoneId}
          onHandleFocusSelection={handleFocusSelection}
          onHandleSaveZones={handleSaveZones}
          onHandleDiscardChanges={handleDiscardChanges}
          onSearchChange={handleMapSheetSearchChange}
        />
      </TabScreenRoot>
    );
  }

  return (
    <MapMobileStage
      t={t}
      palette={palette}
      mapBackgroundColor={mapPalette.styleBackground}
      isFocused={isFocused}
      mapPin={mapPin}
      selectedZoneIds={selectedZoneIds}
      focusZoneId={focusZoneId}
      zoneModeActive={zoneModeActive}
      isSaving={isSaving}
      overlayBottom={overlayBottom}
      cameraPadding={mapCameraPadding}
      onPressZone={toggleZone}
      onPressMap={noopMapPress}
      onRefocus={handleMapUtilityPress}
      onEditToggle={handleEditButtonPress}
    />
  );
}
