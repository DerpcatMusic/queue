// biome-ignore-all lint/suspicious/noApproximativeNumericConstant: normalized palette constants
import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect, useLayoutEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { AnimatedAuroraBackground } from "@/components/ui/aurora-background";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";

// ─── worklet helpers ─────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  "worklet";
  return a + (b - a) * t;
}

// ─── Sport accent map ─────────────────────────────────────────────────────────

const SPORT_AURORA_ACCENTS = {
  pilates: [0.545, 0.361, 0.965] as const, // #8B5CF6
  yoga: [0.231, 0.51, 0.965] as const, // #3B82F6
  barre_flexibility: [0.925, 0.255, 0.6] as const, // #EC4899
  functional_strength: [0.976, 0.451, 0.086] as const, // #F97316
  crossfit: [0.937, 0.267, 0.267] as const, // #EF4444
  performance: [0.918, 0.71, 0.031] as const, // #EAB308
  cycling: [0.024, 0.714, 0.831] as const, // #06B6D4
  dance_fitness: [0.957, 0.247, 0.369] as const, // #F43F5E
  combat_fitness: [0.133, 0.773, 0.369] as const, // #22C55E
  court_club: [0.078, 0.722, 0.651] as const, // #14B8A6
} as const;

type SportKey = keyof typeof SPORT_AURORA_ACCENTS;

// ─── Base route palettes ──────────────────────────────────────────────────────

// index 0 = default, 1 = instructor, 2 = studio
const LIGHT_BASE = {
  skyTop: [
    [0.15, 0.4, 0.85],
    [0.45, 0.2, 0.9],
    [0.15, 0.65, 0.55],
  ] as const,
  aur1: [
    [0.25, 0.5, 1.0],
    [0.6, 0.35, 1.0],
    [0.3, 0.8, 0.7],
  ] as const,
  aur2: [
    [0.35, 0.6, 1.0],
    [0.7, 0.4, 1.0],
    [0.4, 0.9, 0.75],
  ] as const,
  aur3: [
    [0.2, 0.55, 0.95],
    [0.55, 0.3, 0.95],
    [0.25, 0.75, 0.65],
  ] as const,
};

const DARK_BASE = {
  skyTop: [
    [0.12, 0.16, 0.28],
    [0.18, 0.12, 0.3],
    [0.1, 0.2, 0.18],
  ] as const,
  aur1: [
    [0.2, 0.28, 0.58],
    [0.42, 0.22, 0.72],
    [0.18, 0.48, 0.36],
  ] as const,
  aur2: [
    [0.24, 0.32, 0.66],
    [0.5, 0.24, 0.78],
    [0.22, 0.56, 0.4],
  ] as const,
  aur3: [
    [0.16, 0.24, 0.5],
    [0.36, 0.18, 0.62],
    [0.16, 0.42, 0.32],
  ] as const,
};

const LIGHT_SKY_BOTTOM: [number, number, number] = [0.95, 0.94, 0.92];
const DARK_SKY_BOTTOM: [number, number, number] = [0.015, 0.02, 0.035];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingLayout() {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const { setTopInsetVisible, setTopInsetBackgroundColor, setTopInsetTone } = useSystemUi();
  const pathname = usePathname();
  const { sportTheme } = useGlobalSearchParams<{ sportTheme?: SportKey }>();

  const isDark = resolvedScheme === "dark";
  const base = isDark ? DARK_BASE : LIGHT_BASE;
  const skyBottom = isDark ? DARK_SKY_BOTTOM : LIGHT_SKY_BOTTOM;

  // ── Status bar ─────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    setTopInsetVisible(false);
    setTopInsetBackgroundColor("transparent");
    setTopInsetTone("app");
    return () => {
      setTopInsetVisible(true);
      setTopInsetBackgroundColor(null);
      setTopInsetTone("app");
    };
  }, [setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible]);

  // ── Route-level progress (default / instructor / studio) ───────────────────
  const targetRoute = pathname.includes("instructor") ? 1 : pathname.includes("studio") ? 2 : 0;
  const progressSky = useSharedValue(targetRoute);
  const progressAur1 = useSharedValue(targetRoute);
  const progressAur2 = useSharedValue(targetRoute);
  const progressAur3 = useSharedValue(targetRoute);
  const speedBoost = useSharedValue(1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable refs.
  useEffect(() => {
    speedBoost.value = withSequence(
      withTiming(3.5, { duration: 300, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
    );
    progressSky.value = withTiming(targetRoute, {
      duration: 1800,
      easing: Easing.out(Easing.cubic),
    });
    progressAur1.value = withTiming(targetRoute, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
    progressAur2.value = withTiming(targetRoute, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
    progressAur3.value = withTiming(targetRoute, {
      duration: 2000,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetRoute]);

  // ── Sport accent — animated shared values so UI thread blends continuously ─
  // sportBlend = 0 → use base palette; 1 → full sport accent
  const sportBlend = useSharedValue(0);
  const sportR = useSharedValue(0.15);
  const sportG = useSharedValue(0.65);
  const sportB = useSharedValue(0.55);

  const isOnSportsScreen = pathname.includes("studio/sports");

  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable refs.
  useEffect(() => {
    if (isOnSportsScreen && sportTheme && sportTheme in SPORT_AURORA_ACCENTS) {
      const [r, g, b] = SPORT_AURORA_ACCENTS[sportTheme as SportKey];
      // Animate to the new sport color first, then blend in
      sportR.value = withTiming(r, { duration: 600, easing: Easing.out(Easing.cubic) });
      sportG.value = withTiming(g, { duration: 600, easing: Easing.out(Easing.cubic) });
      sportB.value = withTiming(b, { duration: 600, easing: Easing.out(Easing.cubic) });
      sportBlend.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
      // Speed surge on sport change too
      speedBoost.value = withSequence(
        withTiming(2.5, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
      );
    } else {
      sportBlend.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) });
    }
  }, [sportTheme, isOnSportsScreen]);

  // ── Derived aurora colors — everything happens on UI thread ───────────────

  const skyTopShared = useDerivedValue<[number, number, number]>(() => {
    "worklet";
    const p = progressSky.value;
    const from = Math.floor(p);
    const to = Math.min(Math.ceil(p), 2);
    const t = Math.max(0, Math.min(1, p - from));
    const baseR = lerp(base.skyTop[from]![0], base.skyTop[to]![0], t);
    const baseG = lerp(base.skyTop[from]![1], base.skyTop[to]![1], t);
    const baseB = lerp(base.skyTop[from]![2], base.skyTop[to]![2], t);
    const factor = isDark ? 0.38 : 0.62;
    const blend = sportBlend.value;
    return [
      lerp(baseR, sportR.value * factor, blend),
      lerp(baseG, sportG.value * factor, blend),
      lerp(baseB, sportB.value * factor, blend),
    ];
  });

  const aur1Shared = useDerivedValue<[number, number, number]>(() => {
    "worklet";
    const p = progressAur1.value;
    const from = Math.floor(p);
    const to = Math.min(Math.ceil(p), 2);
    const t = Math.max(0, Math.min(1, p - from));
    const baseR = lerp(base.aur1[from]![0], base.aur1[to]![0], t);
    const baseG = lerp(base.aur1[from]![1], base.aur1[to]![1], t);
    const baseB = lerp(base.aur1[from]![2], base.aur1[to]![2], t);
    const blend = sportBlend.value;
    return [
      lerp(baseR, sportR.value, blend),
      lerp(baseG, sportG.value, blend),
      lerp(baseB, sportB.value, blend),
    ];
  });

  const aur2Shared = useDerivedValue<[number, number, number]>(() => {
    "worklet";
    const p = progressAur2.value;
    const from = Math.floor(p);
    const to = Math.min(Math.ceil(p), 2);
    const t = Math.max(0, Math.min(1, p - from));
    const baseR = lerp(base.aur2[from]![0], base.aur2[to]![0], t);
    const baseG = lerp(base.aur2[from]![1], base.aur2[to]![1], t);
    const baseB = lerp(base.aur2[from]![2], base.aur2[to]![2], t);
    const blend = sportBlend.value;
    const satBoost = isDark ? 0.88 : 0.96;
    return [
      lerp(baseR, sportR.value * satBoost, blend),
      lerp(baseG, sportG.value * satBoost, blend),
      lerp(baseB, sportB.value * satBoost, blend),
    ];
  });

  const aur3Shared = useDerivedValue<[number, number, number]>(() => {
    "worklet";
    const p = progressAur3.value;
    const from = Math.floor(p);
    const to = Math.min(Math.ceil(p), 2);
    const t = Math.max(0, Math.min(1, p - from));
    const baseR = lerp(base.aur3[from]![0], base.aur3[to]![0], t);
    const baseG = lerp(base.aur3[from]![1], base.aur3[to]![1], t);
    const baseB = lerp(base.aur3[from]![2], base.aur3[to]![2], t);
    const blend = sportBlend.value;
    const dimFactor = isDark ? 0.72 : 0.84;
    return [
      lerp(baseR, sportR.value * dimFactor, blend),
      lerp(baseG, sportG.value * dimFactor, blend),
      lerp(baseB, sportB.value * dimFactor, blend),
    ];
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.color.appBg }]}>
      <View
        style={[styles.backgroundWrapper, { backgroundColor: theme.color.appBg }]}
        pointerEvents="none"
      >
        <AnimatedAuroraBackground
          width={width}
          height={height}
          skyTopShared={skyTopShared}
          aur1Shared={aur1Shared}
          aur2Shared={aur2Shared}
          aur3Shared={aur3Shared}
          skyBottom={skyBottom}
          intensity={isDark ? 0.34 : 0.42}
          baseSpeed={0.5}
          speedBoost={speedBoost}
        />
        <View
          style={[
            styles.auroraOverlay,
            {
              backgroundColor: isDark ? "rgba(1,4,10,0.34)" : "transparent",
              opacity: isDark ? 1 : 0,
            },
          ]}
        />
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="instructor/profile" />
        <Stack.Screen name="instructor/sports" />
        <Stack.Screen name="studio/profile" />
        <Stack.Screen name="studio/sports" />
        <Stack.Screen name="location" />
        <Stack.Screen name="verification" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.color.appBg,
  },
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.appBg,
  },
  auroraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    opacity: 0,
  },
}));
