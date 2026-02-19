import { StyleSheet, View } from "react-native";

import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExpressiveFab, ExpressiveSurface } from "@/components/ui/expressive";
import { InstructorZonesMap } from "./instructor-zones-map";
import type { OnboardingLocationMapProps } from "./onboarding-location-map.types";

export function OnboardingLocationMap({
  mode,
  pin,
  selectedZoneIds,
  previewZoneIds,
  focusZoneId,
  onPressZone,
  onUseGps,
}: OnboardingLocationMapProps) {
  const scheme = useColorScheme() ?? "light";
  const palette = Brand[scheme];

  if (mode === "instructorZone") {
    return (
      <View style={styles.wrap}>
        <InstructorZonesMap
          zoneMode
          selectedZoneIds={selectedZoneIds}
          previewZoneIds={previewZoneIds}
          focusZoneId={focusZoneId}
          onPressZone={onPressZone}
        />
        <ExpressiveFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
          style={styles.gpsFab}
        />
      </View>
    );
  }

  return (
    <ExpressiveSurface tone="elevated" style={styles.webFallback}>
      <ThemedText type="defaultSemiBold">Map interactions are available in native builds.</ThemedText>
      <ThemedText style={{ color: palette.textMuted }}>
        Use GPS to resolve your exact location, or switch to a native dev build for map pin placement.
      </ThemedText>
      <View style={styles.actions}>
        <ExpressiveFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
        />
      </View>
      <ThemedText style={{ color: palette.textMuted }}>
        {pin
          ? `Pin: ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`
          : "Pin not set yet."}
      </ThemedText>
    </ExpressiveSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 360,
  },
  gpsFab: {
    position: "absolute",
    right: 12,
    bottom: 12,
  },
  webFallback: {
    minHeight: 280,
    justifyContent: "center",
    gap: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
});
