import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useBrand } from "@/hooks/use-brand";
import type { QueueMapProps } from "./queue-map.types";

export function QueueMap(props: QueueMapProps) {
  const palette = useBrand();
  const selectedCount = props.selectedZoneIds.length;
  const selectedZoneSet = new Set(props.selectedZoneIds);

  return (
    <View
      style={[styles.wrap, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
    >
      <ThemedText type="defaultSemiBold">Interactive map is available in native builds.</ThemedText>
      <ThemedText style={{ color: palette.textMuted, textAlign: "center", marginTop: 8 }}>
        You can still manage coverage from the zone list below.
      </ThemedText>
      <ScrollView contentContainerStyle={styles.zoneList}>
        {ZONE_OPTIONS.map((zone) => {
          const selected = selectedZoneSet.has(zone.id);
          return (
            <View
              key={zone.id}
              style={[
                styles.zoneRow,
                {
                  backgroundColor: selected ? palette.primarySubtle : palette.surface,
                  borderColor: selected ? palette.primary : palette.border,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: selected ? palette.primary : palette.text,
                  fontWeight: selected ? "600" : "500",
                }}
                onPress={() => props.onPressZone?.(zone.id)}
              >
                {zone.label.en}
              </ThemedText>
            </View>
          );
        })}
      </ScrollView>
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
    gap: 8,
  },
  zoneList: {
    width: "100%",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 32,
  },
  zoneRow: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
