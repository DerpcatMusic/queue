import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { MapMobileStage } from "@/components/map-tab/map-tab/map-mobile-stage";
import { MapWebWorkbench } from "@/components/map-tab/map-tab/map-web-workbench";
import { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";

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
    handleDiscardChanges,
    handleEditButtonPress,
    handleFocusSelection,
    handleMapSheetSearchChange,
    handleSaveZones,
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
  const handlePressStudio = (studioId: string) => {
    router.push(`/instructor/jobs/studios/${encodeURIComponent(studioId)}` as Href);
  };

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

  if (isMapLoading) {
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
      onPressZone={toggleZone}
      onPressMap={noopMapPress}
      onPressStudio={handlePressStudio}
      onEditToggle={handleEditButtonPress}
    />
  );
}
