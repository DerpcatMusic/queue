import { Redirect } from "expo-router";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import MapTabScreen from "@/components/map-tab";
import { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { isFeatureEnabled } from "@/navigation/tab-registry";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function MapTabRoute() {
  const controller = useMapTabController();

  const descriptorBody = !isFeatureEnabled("instructor", "map.zoneEditor") ? (
    <Redirect href="/instructor" />
  ) : (
    <MapTabScreen controller={controller} />
  );
  useTabSceneDescriptor({ tabId: "map", body: descriptorBody, insetTone: "sheet" });
  useGlobalTopSheet("map", controller.mapSheetConfig, "map:instructor-route");

  return descriptorBody;
}
