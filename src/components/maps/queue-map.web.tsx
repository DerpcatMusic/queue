import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useBrand } from "@/hooks/use-brand";
import type { QueueMapProps } from "./queue-map.types";

export function QueueMap(props: QueueMapProps) {
  const palette = useBrand();
  const selectedZoneSet = new Set(props.selectedZoneIds);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.surfaceAlt }]}>
      <ThemedText type="defaultSemiBold">Map preview is limited on this runtime.</ThemedText>
      <ThemedText style={{ color: palette.textMuted }}>
        Use the zone list below to edit coverage.
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
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
