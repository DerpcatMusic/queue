import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import CalendarTabScreen from "@/components/calendar";

export default function CalendarTabRoute() {
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  if (!hasActivated) {
    return <View className="flex-1 bg-app-bg" />;
  }

  return <CalendarTabScreen />;
}
