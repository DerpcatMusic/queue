import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { KitSurface } from "@/components/ui/kit";
import { Box, Text } from "@/primitives";

const RADIUS_MIN_KM = 1;
const RADIUS_MAX_KM = 50;
const RADIUS_STEP_KM = 0.25;
const THUMB_SIZE = 34;
const TRACK_HEIGHT = 8;
const CONTAINER_HEIGHT = 46;
const STEP_MARK_INTERVAL_KM = 5;

function formatRadiusKm(value: number) {
  return Number.isInteger(value)
    ? `${value} km`
    : `${value.toFixed(2).replace(/\.?0+$/, "")} km`;
}

type MapRadiusControlProps = {
  radiusKm: number;
  studiosCount: number;
  isSaving?: boolean;
  onRadiusChange: (radiusKm: number) => void;
  onRadiusCommit?: (radiusKm: number) => void;
};

export function MapRadiusControl({
  radiusKm,
  studiosCount,
  isSaving = false,
  onRadiusChange,
  onRadiusCommit,
}: MapRadiusControlProps) {
  const { t } = useTranslation();
  const { color: themeColor } = useTheme();
  const { width } = useWindowDimensions();
  const commitRadius = onRadiusCommit ?? onRadiusChange;
  const trackWidth = useMemo(() => {
    return Math.max(240, Math.min(420, width - BrandSpacing.xl * 2 - BrandSpacing.md * 2));
  }, [width]);
  const progress = useSharedValue((radiusKm - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM));
  const lastRadiusKm = useSharedValue(radiusKm);

  useEffect(() => {
    const nextProgress = (radiusKm - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM);
    progress.value = withSpring(Math.max(0, Math.min(1, nextProgress)), {
      damping: 18,
      stiffness: 180,
    });
    lastRadiusKm.value = radiusKm;
  }, [lastRadiusKm, progress, radiusKm]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      "worklet";
      const rawProgress = Math.max(0, Math.min(1, event.x / trackWidth));
      const nextRadiusKm =
        Math.round((RADIUS_MIN_KM + rawProgress * (RADIUS_MAX_KM - RADIUS_MIN_KM)) / RADIUS_STEP_KM) *
        RADIUS_STEP_KM;
      lastRadiusKm.value = nextRadiusKm;
      progress.value = (nextRadiusKm - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM);
      runOnJS(onRadiusChange)(nextRadiusKm);
    })
    .onEnd(() => {
      "worklet";
      runOnJS(commitRadius)(lastRadiusKm.value);
    })
    .hitSlop({ top: 18, bottom: 18, left: 12, right: 12 });

  const tapGesture = Gesture.Tap().onEnd((event) => {
    "worklet";
    const rawProgress = Math.max(0, Math.min(1, event.x / trackWidth));
    const nextRadiusKm =
      Math.round((RADIUS_MIN_KM + rawProgress * (RADIUS_MAX_KM - RADIUS_MIN_KM)) / RADIUS_STEP_KM) *
      RADIUS_STEP_KM;
    progress.value = withSpring(
      (nextRadiusKm - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM),
      { damping: 16, stiffness: 200 },
    );
    lastRadiusKm.value = nextRadiusKm;
    runOnJS(onRadiusChange)(nextRadiusKm);
    runOnJS(commitRadius)(nextRadiusKm);
  });

  const gesture = Gesture.Simultaneous(tapGesture, panGesture);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (trackWidth - THUMB_SIZE) }],
  }));
  const stepMarks = useMemo(
    () =>
      Array.from({ length: Math.floor(RADIUS_MAX_KM / STEP_MARK_INTERVAL_KM) + 1 }, (_, index) =>
        index * STEP_MARK_INTERVAL_KM,
      ),
    [],
  );

  return (
    <KitSurface
      tone="sheet"
      padding={BrandSpacing.lg}
      gap={BrandSpacing.md}
      style={styles.root}
    >
      <Box style={styles.header}>
        <Box style={styles.headerRow}>
          <Text
            style={{
              ...BrandType.bodyStrong,
              color: themeColor.text,
            }}
          >
            {t("mapTab.mobile.radiusTitle")}
          </Text>
          <Animated.View key={String(studiosCount)} entering={FadeIn.duration(140)}>
            <Text
              style={{
                ...BrandType.caption,
                color: themeColor.primary,
                fontWeight: "700",
              }}
            >
              {t("mapTab.mobile.radiusCount", { count: studiosCount })}
            </Text>
          </Animated.View>
        </Box>
        <Text
          style={{
            ...BrandType.caption,
            color: themeColor.textMuted,
          }}
        >
          {t("mapTab.mobile.radiusHint")}
        </Text>
      </Box>

      <Box style={styles.sliderRow}>
        <Text style={{ ...BrandType.caption, color: themeColor.textMuted }}>
          {formatRadiusKm(RADIUS_MIN_KM)}
        </Text>

        <GestureDetector gesture={gesture}>
          <Box
            style={{
              width: trackWidth,
              height: CONTAINER_HEIGHT,
              justifyContent: "center",
            }}
          >
            <Box
              style={{
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT / 2,
                backgroundColor: themeColor.surfaceAlt,
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={[
                  {
                    height: "100%",
                    backgroundColor: themeColor.primary,
                    borderRadius: TRACK_HEIGHT / 2,
                  },
                  fillStyle,
                ]}
              />
            </Box>

            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                  borderRadius: THUMB_SIZE / 2,
                  top: (CONTAINER_HEIGHT - THUMB_SIZE) / 2,
                  backgroundColor: themeColor.surface,
                  borderWidth: 4,
                  borderColor: themeColor.primary,
                  shadowColor: "#000",
                  shadowOpacity: 0.16,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                },
                thumbStyle,
              ]}
            />
          </Box>
        </GestureDetector>

        <Text style={{ ...BrandType.caption, color: themeColor.textMuted }}>
          {formatRadiusKm(RADIUS_MAX_KM)}
        </Text>
      </Box>

      <Box style={[styles.stepRail, { width: trackWidth }]}>
        {stepMarks.map((mark) => {
          const isMajor = mark % 10 === 0;
          return (
            <Box
              key={mark}
              style={[
                styles.stepTick,
                {
                  height: isMajor ? 10 : 6,
                  opacity: isMajor ? 0.5 : 0.28,
                  backgroundColor: themeColor.primary,
                },
              ]}
            />
          );
        })}
      </Box>

      <Box style={styles.footerRow}>
        <Text
          style={{
            ...BrandType.caption,
            color: themeColor.textMuted,
          }}
        >
          {formatRadiusKm(radiusKm)}
        </Text>
        <Text
          style={{
            ...BrandType.caption,
            color: isSaving ? themeColor.primary : themeColor.textMuted,
          }}
        >
          {isSaving ? t("mapTab.mobile.radiusSaving") : t("mapTab.mobile.radiusLive")}
        </Text>
      </Box>
      <Text
        style={{
          ...BrandType.caption,
          color: themeColor.textMuted,
        }}
      >
        {RADIUS_STEP_KM * 1000}
        m steps
      </Text>
    </KitSurface>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
  },
  header: {
    gap: BrandSpacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepRail: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "center",
  },
  stepTick: {
    width: 1,
    borderRadius: 999,
  },
}));
