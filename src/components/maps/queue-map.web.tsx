import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";
import type { QueueMapProps } from "./queue-map.types";

export function QueueMap(props: QueueMapProps) {
  const palette = useBrand();
  const selectedCount = props.selectedZoneIds.length;

  return (
    <View
      style={[styles.wrap, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
    >
      <ThemedText type="defaultSemiBold">Interactive map is available in native builds.</ThemedText>
      <ThemedText style={{ color: palette.textMuted, textAlign: "center", marginTop: 8 }}>
        You can still manage coverage from the zone list below.
      </ThemedText>
      {props.mode === "zoneSelect" ? (
        <ThemedText style={{ color: palette.primary, marginTop: 8 }}>
          {selectedCount} zone{selectedCount === 1 ? "" : "s"} selected
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: "continuous",
    margin: 16,
  },
});
