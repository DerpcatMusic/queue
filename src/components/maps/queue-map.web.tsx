import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";
import type { QueueMapProps } from "./queue-map.types";

export function QueueMap(_props: QueueMapProps) {
  const palette = useBrand();

  return (
    <View style={[styles.wrap, { backgroundColor: palette.surfaceAlt }]}>
      <ThemedText type="defaultSemiBold">Map is available in native builds.</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});

