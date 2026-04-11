import { Redirect } from "expo-router";
import { useLayoutEffect } from "react";
import MapTabScreen from "@/components/map-tab";
import { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { useSystemUi } from "@/contexts/system-ui-context";
import { isFeatureEnabled } from "@/navigation/tab-registry";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function MapTabRoute() {
  const controller = useMapTabController();
  const { setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible } = useSystemUi();

  useLayoutEffect(() => {
    setTopInsetTone("app");
    setTopInsetBackgroundColor(controller.mapPalette.styleBackground);
    setTopInsetVisible(false);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
      setTopInsetVisible(true);
    };
  }, [
    controller.mapPalette.styleBackground,
    setTopInsetBackgroundColor,
    setTopInsetTone,
    setTopInsetVisible,
  ]);

  const descriptorBody = !isFeatureEnabled("instructor", "map.zoneEditor") ? (
    <Redirect href="/instructor" />
  ) : (
    <MapTabScreen controller={controller} />
  );
  useTabSceneDescriptor({
    tabId: "map",
    body: descriptorBody,
    insetTone: "app",
    backgroundColor: controller.mapPalette.styleBackground,
  });

  return descriptorBody;
}
