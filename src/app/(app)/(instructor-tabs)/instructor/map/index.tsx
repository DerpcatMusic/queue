import { Redirect } from "expo-router";
import MapTabScreen from "@/components/map-tab/map-tab-screen";
import { isFeatureEnabled } from "@/navigation/tab-registry";

export default function MapTabRoute() {
  if (!isFeatureEnabled("instructor", "map.zoneEditor")) {
    return <Redirect href="/instructor" />;
  }

  return <MapTabScreen />;
}
