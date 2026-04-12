import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { MapMobileStage } from "@/components/map-tab/map-tab/map-mobile-stage";
import { MapWebWorkbench } from "@/components/map-tab/map-tab/map-web-workbench";
import type { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { buildStudioProfileRoute } from "@/navigation/public-profile-routes";
import { useTheme } from "@/hooks/use-theme";

type MapTabScreenProps = {
  controller: ReturnType<typeof useMapTabController>;
};

export default function MapTabScreen({ controller }: MapTabScreenProps) {
  const router = useRouter();
  const { color } = useTheme();
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
    mapCameraPadding,
    mapPalette,
    mapPin,
    boundaryIdProperty,
    boundaryInteractionBounds,
    boundaryLabelPropertyCandidates,
    boundarySource,
    focusBoundaryBounds,
    initialBoundaryViewport,
    studios,
    noopMapPress,
    overlayBottom,
    pendingChangeCount,
    persistedZoneIds,
    saveError,
    studioCount,
    selectedStudio,
    selectedStudioId,
    selectedZoneIds,
    selectedZones,
    setFocusZoneId,
    t,
    toggleZone,
    showRadiusControl,
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
        router.push(buildStudioProfileRoute({ owner: "map", studioId }));
      });
    },
    [handleCloseStudio, router],
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
    );
  }

  return (
    <MapMobileStage
      t={t}
      mapBackgroundColor={mapBackgroundColor}
      isFocused={isFocused}
      mapPin={mapPin}
      studios={studios}
      selectedZoneIds={selectedZoneIds}
      focusZoneId={focusZoneId}
      overlayBottom={overlayBottom}
      cameraPadding={mapCameraPadding}
      selectedStudio={selectedStudio}
      selectedStudioId={selectedStudioId}
      zoneLanguage={zoneLanguage}
      showRadiusControl={showRadiusControl}
      workRadiusKm={workRadiusKm}
      studioCount={studioCount}
      isRadiusPanelOpen={isRadiusPanelOpen}
      onPressMap={noopMapPress}
      onPressStudio={handleSelectStudio}
      onCloseStudio={handleCloseStudio}
      onOpenStudioProfile={handleOpenStudioProfile}
      onRadiusChange={handleRadiusChange}
      onRadiusCommit={handleRadiusCommit}
      onRadiusPanelToggle={handleRadiusPanelToggle}
      isRadiusSaving={isRadiusSaving}
      {...(boundarySource ? { boundarySource } : {})}
      {...(boundaryIdProperty ? { boundaryIdProperty } : {})}
      {...(boundaryLabelPropertyCandidates ? { boundaryLabelPropertyCandidates } : {})}
      {...(boundaryInteractionBounds ? { boundaryInteractionBounds } : {})}
      {...(focusBoundaryBounds ? { focusBoundaryBounds } : {})}
      {...(initialBoundaryViewport ? { initialBoundaryViewport } : {})}
    />
  );
}
