import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { MapMobileStage } from "@/components/map-tab/map-tab/map-mobile-stage";
import { MapWebWorkbench } from "@/components/map-tab/map-tab/map-web-workbench";
import type { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { buildStudioProfileRoute } from "@/navigation/public-profile-routes";

type MapTabScreenProps = {
  controller: ReturnType<typeof useMapTabController>;
};

export default function MapTabScreen({ controller }: MapTabScreenProps) {
  const router = useRouter();
  const {
    currentUser,
    filteredZones,
    focusZoneId,
    focusedZoneLabel,
    focusedZoneStudioCount,
    handleDiscardChanges,
    handleCloseStudio,
    handleEditButtonPress,
    handleFocusSelection,
    handleMapSheetSearchChange,
    handleSaveZones,
    handleSelectStudio,
    hasChanges,
    isFocused,
    isMapBodyReady,
    isSaving,
    mapCameraPadding,
    mapPalette,
    mapPin,
    studios,
    noopMapPress,
    overlayBottom,
    pendingChangeCount,
    persistedZoneIds,
    saveError,
    selectedStudio,
    selectedStudioId,
    selectedZoneIds,
    selectedZones,
    setFocusZoneId,
    t,
    toggleZone,
    zoneLanguage,
    zoneSearch,
    zoneModeActive,
  } = controller;
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
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="card"
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

  if (isMapLoading) {
    return (
      <TabScreenRoot
        mode="static"
        topInsetTone="card"
        style={{ backgroundColor: mapPalette.styleBackground }}
      >
        <View style={{ flex: 1, backgroundColor: mapPalette.styleBackground }} />
      </TabScreenRoot>
    );
  }

  if (Platform.OS === "web") {
    return (
      <TabScreenRoot mode="static" topInsetTone="card">
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
      </TabScreenRoot>
    );
  }

  return (
    <MapMobileStage
      t={t}
      mapBackgroundColor={mapPalette.styleBackground}
      isFocused={isFocused}
      mapPin={mapPin}
      studios={studios}
      selectedZoneIds={selectedZoneIds}
      focusZoneId={focusZoneId}
      zoneModeActive={zoneModeActive}
      isSaving={isSaving}
      overlayBottom={overlayBottom}
      cameraPadding={mapCameraPadding}
      selectedStudio={selectedStudio}
      selectedStudioId={selectedStudioId}
      focusedZoneLabel={focusedZoneLabel}
      focusedZoneStudioCount={focusedZoneStudioCount}
      zoneLanguage={zoneLanguage}
      onPressZone={toggleZone}
      onPressMap={noopMapPress}
      onPressStudio={handleSelectStudio}
      onCloseStudio={handleCloseStudio}
      onOpenStudioProfile={handleOpenStudioProfile}
      onEditToggle={handleEditButtonPress}
    />
  );
}
