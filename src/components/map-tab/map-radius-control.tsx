import { useEffect, useMemo, useRef } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";

const RADIUS_MIN_KM = 1;
const RADIUS_MAX_KM = 50;
const RADIUS_STEP_KM = 0.25;

function formatRadiusKm(value: number) {
  return Number.isInteger(value) ? `${value} km` : `${value.toFixed(2).replace(/\.?0+$/, "")} km`;
}

function roundRadiusKm(value: number) {
  const clamped = Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, value));
  return Math.round(clamped / RADIUS_STEP_KM) * RADIUS_STEP_KM;
}

type MapRadiusControlProps = {
  radiusKm: number;
  isSaving?: boolean;
  style?: StyleProp<ViewStyle>;
  onRadiusChange: (radiusKm: number) => void;
  onRadiusCommit?: (radiusKm: number) => void;
};

export function MapRadiusControl({
  radiusKm,
  isSaving = false,
  style,
  onRadiusChange,
  onRadiusCommit,
}: MapRadiusControlProps) {
  const { color: themeColor, scheme } = useTheme();
  const commitRadius = onRadiusCommit ?? onRadiusChange;
  const lastRadiusKm = useRef(radiusKm);
  const nativeSlider = useMemo(() => {
    if (Platform.OS === "android") {
      try {
        const compose = require("@expo/ui/jetpack-compose");
        const modifiers = require("@expo/ui/jetpack-compose/modifiers");
        return {
          Host: compose.Host as any,
          Slider: compose.Slider as any,
          fillMaxWidth: modifiers.fillMaxWidth as any,
          height: modifiers.height as any,
        };
      } catch {
        return null;
      }
    }

    if (Platform.OS === "ios") {
      try {
        const swiftUi = require("@expo/ui/swift-ui");
        const modifiers = require("@expo/ui/swift-ui/modifiers");
        return {
          Host: swiftUi.Host as any,
          Slider: swiftUi.Slider as any,
          frame: modifiers.frame as any,
        };
      } catch {
        return null;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    lastRadiusKm.current = radiusKm;
  }, [radiusKm]);

  const sliderValue = useMemo(() => roundRadiusKm(radiusKm), [radiusKm]);
  const handleChange = (value: number) => {
    const nextRadiusKm = roundRadiusKm(value);
    lastRadiusKm.current = nextRadiusKm;
    onRadiusChange(nextRadiusKm);
  };

  const handleCommit = () => {
    commitRadius(lastRadiusKm.current);
  };

  const NativeHost = nativeSlider?.Host as any;
  const NativeSlider = nativeSlider?.Slider as any;
  const nativeFillMaxWidth = nativeSlider?.fillMaxWidth as any;
  const nativeHeight = nativeSlider?.height as any;
  const nativeFrame = nativeSlider?.frame as any;

  const sliderNode = nativeSlider ? (
    Platform.OS === "android" && NativeHost && NativeSlider ? (
      <NativeHost
        matchContents={false}
        colorScheme={scheme}
        style={{ width: "100%", height: BrandSpacing.controlLg }}
      >
        <NativeSlider
          value={sliderValue}
          min={RADIUS_MIN_KM}
          max={RADIUS_MAX_KM}
          enabled={!isSaving}
          colors={{
            thumbColor: themeColor.primary,
            activeTrackColor: themeColor.primary,
            inactiveTrackColor: themeColor.surfaceMuted,
          }}
          onValueChange={handleChange}
          onValueChangeFinished={handleCommit}
          modifiers={
            [
              nativeFillMaxWidth ? nativeFillMaxWidth() : null,
              nativeHeight ? nativeHeight(BrandSpacing.controlLg) : null,
            ].filter(Boolean)
          }
        />
      </NativeHost>
    ) : NativeHost && NativeSlider ? (
      <NativeHost
        matchContents={false}
        colorScheme={scheme === "dark" ? "dark" : "light"}
        style={{ width: "100%", height: BrandSpacing.controlLg }}
      >
        <NativeSlider
          value={sliderValue}
          step={RADIUS_STEP_KM}
          min={RADIUS_MIN_KM}
          max={RADIUS_MAX_KM}
          modifiers={
            nativeFrame
              ? [
                  nativeFrame({
                    maxWidth: Number.MAX_SAFE_INTEGER,
                    height: BrandSpacing.controlLg,
                  }),
                ]
              : []
          }
          onValueChange={handleChange}
          onEditingChanged={(isEditing: boolean) => {
            if (!isEditing) {
              handleCommit();
            }
          }}
        />
      </NativeHost>
    ) : null
  ) : null;

  return (
    <Box style={[styles.root, style]}>
      <Box style={styles.sliderRow}>
        <Text style={{ color: themeColor.textMuted, fontSize: 14, lineHeight: 19 }}>
          {formatRadiusKm(RADIUS_MIN_KM)}
        </Text>

        <Box style={styles.sliderShell}>{sliderNode}</Box>

        <Text style={{ color: themeColor.textMuted, fontSize: 14, lineHeight: 19 }}>
          {formatRadiusKm(RADIUS_MAX_KM)}
        </Text>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create(() => ({
  root: {
    gap: BrandSpacing.xs,
    minWidth: 0,
    flex: 1,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
    minWidth: 0,
  },
  sliderShell: {
    flex: 1,
    minWidth: 0,
  },
}));
