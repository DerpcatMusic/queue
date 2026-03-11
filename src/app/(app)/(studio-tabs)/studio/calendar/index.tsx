import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import CalendarTabScreen from "@/components/calendar/calendar-tab-screen";
import { useBrand } from "@/hooks/use-brand";

export default function CalendarTabRoute() {
  const palette = useBrand();
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  if (!hasActivated) {
    return <View style={{ flex: 1, backgroundColor: palette.appBg as string }} />;
  }

  return <CalendarTabScreen />;
}
