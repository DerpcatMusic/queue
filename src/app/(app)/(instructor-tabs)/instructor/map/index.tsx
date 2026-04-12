import { Redirect } from "expo-router";
import { useLayoutEffect } from "react";
import MapTabScreen from "@/components/map-tab";
import { useMapTabController } from "@/components/map-tab/map-tab/use-map-tab-controller";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useTheme } from "@/hooks/use-theme";
import { isFeatureEnabled } from "@/navigation/tab-registry";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function MapTabRoute() {
  const controller = useMapTabController();
  const { color } = useTheme();
  const { setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible } = useSystemUi();
  const mapBackgroundColor = controller.mapPalette?.styleBackground ?? color.appBg;

  useLayoutEffect(() => {
    setTopInsetTone("app");
    setTopInsetBackgroundColor(mapBackgroundColor);
    setTopInsetVisible(false);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
      setTopInsetVisible(true);
    };
  }, [
    mapBackgroundColor,
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
    backgroundColor: mapBackgroundColor,
  });

  return descriptorBody;
}
