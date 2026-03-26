import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import CalendarTabScreen from "@/components/calendar";
import { useTheme } from "@/hooks/use-theme";

export default function CalendarTabRoute() {
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  if (!hasActivated) {
    return <View style={{ flex: 1, backgroundColor: theme.color.appBg }} />;
  }

  return <CalendarTabScreen />;
}
