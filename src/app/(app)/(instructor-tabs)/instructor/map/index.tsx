import { Redirect } from "expo-router";
import { useMemo } from "react";
import { MapSheetHeader } from "@/components/map-tab/map-tab/map-sheet-header";
import MapTabScreen from "@/components/map-tab";
import { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { isFeatureEnabled } from "@/navigation/tab-registry";
import { useTheme } from "@/hooks/use-theme";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function MapTabRoute() {
  const theme = useTheme();
  const controller = useMapTabController();

  const sheetContent = useMemo(
    () => (
      <MapSheetHeader
        focusZoneId={controller.focusZoneId}
        onChangeSearch={controller.handleMapSheetSearchChange}
        mapPalette={controller.mapPalette}
        selectedZones={controller.selectedZones}
        onPressZone={controller.toggleZone}
        t={controller.t}
        zoneLanguage={controller.zoneLanguage}
        zoneSearch={controller.zoneSearch}
      />
    ),
    [
      controller.focusZoneId,
      controller.handleMapSheetSearchChange,
      controller.mapPalette,
      controller.selectedZones,
      controller.t,
      controller.toggleZone,
      controller.zoneLanguage,
      controller.zoneSearch,
    ],
  );

  const sheetConfig = useMemo(
    () => ({
      render: () => ({
        children: sheetContent,
      }),
      steps: [0] as const,
      initialStep: 0,
      collapsedHeightMode: "content" as const,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      backgroundColor: theme.color.surfaceAlt,
      topInsetColor: theme.color.surfaceAlt,
    }),
    [sheetContent, theme.color.surfaceAlt],
  );

  const descriptorBody = !isFeatureEnabled("instructor", "map.zoneEditor") ? (
    <Redirect href="/instructor" />
  ) : (
    <MapTabScreen controller={controller} />
  );

  const descriptor = useMemo(
    () => ({
      tabId: "map" as const,
      body: descriptorBody,
      sheetConfig,
      insetTone: "sheet" as const,
    }),
    [descriptorBody, sheetConfig],
  );

  useTabSceneDescriptor(descriptor);

  return descriptorBody;
}
