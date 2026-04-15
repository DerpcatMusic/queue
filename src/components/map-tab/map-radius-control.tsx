import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";
import {
  radiusKmToSliderValue,
  roundRadiusKm,
  sliderValueToRadiusKm,
} from "@/lib/radius-scale";

const RADIUS_MIN_KM = 0.25;
const RADIUS_MAX_KM = 40;

function formatRadiusKm(value: number) {
  if (value < 1) {
    return `${Math.round(value * 1000)} m`;
  }
  return Number.isInteger(value) ? `${value} km` : `${value.toFixed(2).replace(/\.?0+$/, "")} km`;
}

type MapRadiusControlProps = {
  radiusKm: number;
  isSaving?: boolean;
  commuteEstimateLabel?: string | null | undefined;
  activeResolutionLabel?: string | null | undefined;
  savedCoordinatesLabel?: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  onRadiusChange: (radiusKm: number) => void;
  onRadiusCommit?: (radiusKm: number) => void;
};

export function MapRadiusControl({
  radiusKm,
  isSaving = false,
  commuteEstimateLabel,
  activeResolutionLabel,
  savedCoordinatesLabel,
  style,
  onRadiusChange,
  onRadiusCommit,
}: MapRadiusControlProps) {
  const { color: themeColor, scheme } = useTheme();
  const commitRadius = onRadiusCommit ?? onRadiusChange;
  const lastRadiusKm = useRef(radiusKm);
  const [liveRadiusKm, setLiveRadiusKm] = useState(radiusKm);
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
    setLiveRadiusKm(radiusKm);
  }, [radiusKm]);

  const sliderValue = useMemo(() => radiusKmToSliderValue(liveRadiusKm), [liveRadiusKm]);
  const handleChange = (value: number) => {
    const nextRadiusKm = roundRadiusKm(sliderValueToRadiusKm(value));
    lastRadiusKm.current = nextRadiusKm;
    setLiveRadiusKm(nextRadiusKm);
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
          min={0}
          max={1}
          enabled={!isSaving}
          colors={{
            thumbColor: themeColor.primary,
            activeTrackColor: themeColor.primary,
            inactiveTrackColor: themeColor.surfaceMuted,
          }}
          onValueChange={handleChange}
          onValueChangeFinished={handleCommit}
          modifiers={[
            nativeFillMaxWidth ? nativeFillMaxWidth() : null,
            nativeHeight ? nativeHeight(BrandSpacing.controlLg) : null,
          ].filter(Boolean)}
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
          step={0.001}
          min={0}
          max={1}
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

        <Box style={styles.sliderShell}>
          <Box
            pointerEvents="none"
            style={[
              styles.sliderBubble,
              {
                left: `${Math.min(100, Math.max(0, sliderValue * 100))}%`,
                backgroundColor: themeColor.surface,
                borderColor: themeColor.primary,
              },
            ]}
          >
            <Text
              style={{
                color: themeColor.text,
                fontSize: 12,
                lineHeight: 16,
                fontWeight: "600",
              }}
            >
              {formatRadiusKm(liveRadiusKm)}
            </Text>
          </Box>
          <Box style={styles.sliderTrack}>{sliderNode}</Box>
        </Box>

        <Text style={{ color: themeColor.textMuted, fontSize: 14, lineHeight: 19 }}>
          {formatRadiusKm(RADIUS_MAX_KM)}
        </Text>
      </Box>
      {commuteEstimateLabel ? (
        <Text
          style={{
            color: themeColor.textMuted,
            fontSize: 12,
            lineHeight: 16,
            textAlign: "center",
          }}
        >
          {commuteEstimateLabel}
        </Text>
      ) : null}
      {activeResolutionLabel ? (
        <Text
          style={{
            color: themeColor.textMuted,
            fontSize: 12,
            lineHeight: 16,
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          {activeResolutionLabel}
        </Text>
      ) : null}
      {savedCoordinatesLabel ? (
        <Text
          style={{
            color: themeColor.textMuted,
            fontSize: 12,
            lineHeight: 16,
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          {savedCoordinatesLabel}
        </Text>
      ) : null}
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
    position: "relative",
    paddingTop: BrandSpacing.lg,
  },
  sliderTrack: {
    marginTop: BrandSpacing.xs,
  },
  sliderBubble: {
    position: "absolute",
    top: 0,
    minWidth: 60,
    paddingHorizontal: BrandSpacing.xs,
    paddingVertical: 4,
    borderRadius: BrandRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    transform: [{ translateX: -30 }],
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
}));
