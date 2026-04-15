import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { MapMobileStage } from "@/components/map-tab/map-tab/map-mobile-stage";
import { MapWebWorkbench } from "@/components/map-tab/map-tab/map-web-workbench";
import type { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { useOpenPublicProfileSheet } from "@/contexts/sheet-context";
import { useTheme } from "@/hooks/use-theme";
import type { SelectableBoundary } from "@/features/maps/boundaries/catalog";

type MapTabScreenProps = {
  controller: ReturnType<typeof useMapTabController>;
};

export default function MapTabScreen({ controller }: MapTabScreenProps) {
  const { color } = useTheme();
  const publicProfileHandlers = useOpenPublicProfileSheet();
  const {
    currentUser,
    filteredZones,
    focusZoneId,
    focusedZoneLabel,
    handleDiscardChanges,
    handleCloseStudio,
    handleFocusSelection,
    handleMapSheetSearchChange,
    handleSaveZones,
    handleRadiusChange,
    handleRadiusCommit,
    handleSelectStudio,
    hasChanges,
    isFocused,
    isMapBodyReady,
    isSaving,
    isRadiusSaving,
    isRadiusPanelOpen,
    focusFrameKey,
    mapCameraPadding,
    mapPalette,
    mapPin,
    coveragePolygons,
    studios,
    noopMapPress,
    pendingChangeCount,
    persistedZoneIds,
    saveError,
    selectedStudio,
    selectedStudioId,
    selectedZoneIds,
    selectedZones,
    showRadiusControl,
    commuteEstimateLabel,
    activeResolutionLabel,
    savedCoordinatesLabel,
    setFocusZoneId,
    t,
    toggleZone,
    workRadiusKm,
    zoneLanguage,
    zoneSearch,
    handleRadiusPanelToggle,
  } = controller;
  const mapBackgroundColor = mapPalette?.styleBackground ?? color.appBg;
  const [isMapLoading, setIsMapLoading] = useState(true);
  useEffect(() => {
    if (isMapBodyReady) {
      setIsMapLoading(false);
    }
  }, [isMapBodyReady]);
  const handleOpenStudioProfile = useCallback(
    (studioId: string) => {
      handleCloseStudio();
      requestAnimationFrame(() => {
        publicProfileHandlers.openStudioProfile(studioId);
      });
    },
    [handleCloseStudio, publicProfileHandlers],
  );

  if (currentUser === undefined) {
    return <View style={{ flex: 1, backgroundColor: mapBackgroundColor }} />;
  }

  if (!currentUser) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/studio" />;
  }

  if (isMapLoading) {
    return <View style={{ flex: 1, backgroundColor: mapBackgroundColor }} />;
  }

  if (Platform.OS === "web") {
    return (
      <MapWebWorkbench
        t={t}
        zoneLanguage={zoneLanguage}
        zoneSearch={zoneSearch}
        selectedZones={selectedZones as unknown as SelectableBoundary[]}
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
    );
  }

  return (
    <MapMobileStage
      t={t}
      mapBackgroundColor={mapBackgroundColor}
      isFocused={isFocused}
      mapPin={mapPin}
      studios={studios}
      coveragePolygons={coveragePolygons}
      selectedZoneIds={selectedZoneIds}
      focusZoneId={focusZoneId}
      cameraPadding={mapCameraPadding}
      selectedStudio={selectedStudio}
      selectedStudioId={selectedStudioId}
      zoneLanguage={zoneLanguage}
      showRadiusControl={showRadiusControl}
      commuteEstimateLabel={commuteEstimateLabel}
      activeResolutionLabel={activeResolutionLabel}
      savedCoordinatesLabel={savedCoordinatesLabel}
      workRadiusKm={workRadiusKm}
      isRadiusPanelOpen={isRadiusPanelOpen}
      onPressMap={noopMapPress}
      onPressStudio={handleSelectStudio}
      onCloseStudio={handleCloseStudio}
      onOpenStudioProfile={handleOpenStudioProfile}
      onRadiusChange={handleRadiusChange}
      onRadiusCommit={handleRadiusCommit}
      onRadiusPanelToggle={handleRadiusPanelToggle}
      isRadiusSaving={isRadiusSaving}
      focusFrameKey={focusFrameKey}
    />
  );
}
