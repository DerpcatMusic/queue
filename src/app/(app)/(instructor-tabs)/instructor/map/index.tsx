import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import MapTabScreen from "@/components/map-tab";
import { isFeatureEnabled } from "@/navigation/tab-registry";

export default function MapTabRoute() {
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  if (!isFeatureEnabled("instructor", "map.zoneEditor")) {
    return <Redirect href="/instructor" />;
  }

  if (!hasActivated) {
    return <View className="flex-1 bg-app-bg" />;
  }

  return <MapTabScreen />;
}
