import Constants from "expo-constants";
import { Platform, StyleSheet, View } from "react-native";

import { useBrand } from "@/hooks/use-brand";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitFab, KitSurface } from "@/components/ui/kit";
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

  const palette = useBrand();
  const isExpoGoNative =
    Platform.OS !== "web" && Constants.appOwnership === "expo";

  if (isExpoGoNative) {
    return (
      <KitSurface tone="elevated" style={styles.webFallback}>
        <ThemedText type="defaultSemiBold">Native map requires a development build.</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          Run `bunx expo run:android` and relaunch your dev client.
        </ThemedText>
        <View style={styles.actions}>
          <KitFab
            icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
            onPress={onUseGps}
          />
        </View>
        <ThemedText style={{ color: palette.textMuted }}>
          {pin
            ? `Pin: ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`
            : "Pin not set yet."}
        </ThemedText>
      </KitSurface>
    );
  }

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
        <KitFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
          style={styles.gpsFab}
        />
      </View>
    );
  }

  return (
    <KitSurface tone="elevated" style={styles.webFallback}>
      <ThemedText type="defaultSemiBold">Map interactions are available in native builds.</ThemedText>
      <ThemedText style={{ color: palette.textMuted }}>
        Use GPS to resolve your exact location, or switch to a native dev build for map pin placement.
      </ThemedText>
      <View style={styles.actions}>
        <KitFab
          icon={<IconSymbol name="location.fill" size={22} color={palette.text} />}
          onPress={onUseGps}
        />
      </View>
      <ThemedText style={{ color: palette.textMuted }}>
        {pin
          ? `Pin: ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`
          : "Pin not set yet."}
      </ThemedText>
    </KitSurface>
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

