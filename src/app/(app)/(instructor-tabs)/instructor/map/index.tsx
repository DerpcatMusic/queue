import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import MapTabScreen from "@/components/map-tab";
import { useBrand } from "@/hooks/use-brand";
import { isFeatureEnabled } from "@/navigation/tab-registry";

export default function MapTabRoute() {
  const palette = useBrand();
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
    return <View style={{ flex: 1, backgroundColor: palette.appBg as string }} />;
  }

  return <MapTabScreen />;
}
