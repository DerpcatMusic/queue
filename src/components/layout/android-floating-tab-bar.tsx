import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  I18nManager,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { useTabBarScrollContext } from "@/contexts/tab-bar-scroll-context";
import { useBrand } from "@/hooks/use-brand";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import { recordPerfMetric } from "@/lib/perf-telemetry";

export type FloatingTabSpec = {
  key: string;
  label: string;
  iconName: keyof typeof MaterialIcons.glyphMap;
  badgeCount?: number;
};

type AndroidFloatingTabBarProps = {
  tabs: FloatingTabSpec[];
  activeKey: string;
  onSelect: (key: string) => void;
};

const COLLAPSE_OFFSET_THRESHOLD = 52;
const EXPAND_SCROLL_UP_VELOCITY = 0.03;
const EXPANDED_HEIGHT = 62;
const EXPANDED_WIDTH = 320;
const COMPACT_WIDTH = 74;

function nowMs() {
  return Date.now();
}

export function AndroidFloatingTabBar({
  tabs,
  activeKey,
  onSelect,
}: AndroidFloatingTabBarProps) {
  const palette = useBrand();
  const { bottomOverlayInset } = useNativeTabLayout();
  const { getSignal } = useTabBarScrollContext();
  const [isCompact, setIsCompact] = useState(FEATURE_FLAGS.androidFloatingTabsCompactOnly);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const compactProgress = useRef(new Animated.Value(isCompact ? 1 : 0)).current;
  const lastTransitionAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setPrefersReducedMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setPrefersReducedMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (FEATURE_FLAGS.androidFloatingTabsCompactOnly) return;
    const timer = setInterval(() => {
      const signal = getSignal(activeKey);
      if (!signal) return;
      if (nowMs() - lastTransitionAtRef.current < 180) return;

      if (!isCompact && signal.direction === "down" && signal.offset > COLLAPSE_OFFSET_THRESHOLD) {
        setIsCompact(true);
        lastTransitionAtRef.current = nowMs();
        recordPerfMetric("android_tabbar_state_change", 1, {
          from: "expanded",
          to: "compact",
          trigger: "scroll_down",
          route: activeKey,
        });
        return;
      }

      if (isCompact && (signal.direction === "up" || signal.velocity >= EXPAND_SCROLL_UP_VELOCITY)) {
        setIsCompact(false);
        lastTransitionAtRef.current = nowMs();
        recordPerfMetric("android_tabbar_auto_expand_scrollup", 1, { route: activeKey });
      }
    }, 120);

    return () => clearInterval(timer);
  }, [activeKey, getSignal, isCompact]);

  useEffect(() => {
    Animated.timing(compactProgress, {
      toValue: isCompact ? 1 : 0,
      duration: prefersReducedMotion ? 0 : 220,
      useNativeDriver: false,
    }).start();
  }, [compactProgress, isCompact, prefersReducedMotion]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === activeKey) ?? tabs[0] ?? null,
    [activeKey, tabs],
  );

  if (!activeTab) return null;

  const translateX = compactProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, I18nManager.isRTL ? 120 : -120],
  });
  const width = compactProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [EXPANDED_WIDTH, COMPACT_WIDTH],
  });
  const contentOpacity = compactProgress.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.2, 0],
  });
  const compactOpacity = compactProgress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.3, 1],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          bottom: bottomOverlayInset,
          width,
          transform: [{ translateX }],
          backgroundColor: palette.tabBar as string,
          borderColor: palette.tabBarBorder as string,
        },
      ]}
    >
      <Animated.View style={[styles.expandedRow, { opacity: contentOpacity }]}>
        {tabs.map((tab) => {
          const selected = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              style={styles.tabButton}
              onPress={() => {
                onSelect(tab.key);
              }}
              hitSlop={8}
            >
              <MaterialIcons
                name={tab.iconName}
                size={22}
                color={selected ? (palette.primary as string) : (palette.textMuted as string)}
              />
              <Animated.Text
                style={[
                  styles.tabLabel,
                  {
                    color: selected ? (palette.primary as string) : (palette.textMuted as string),
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </Animated.View>

      <Animated.View style={[styles.compactWrap, { opacity: compactOpacity }]}>
        <Pressable
          style={styles.compactButton}
          onPress={() => {
            if (isCompact) {
              setIsCompact(false);
              recordPerfMetric("android_tabbar_tap_expand", 1, { route: activeKey });
              return;
            }
            onSelect(activeTab.key);
          }}
          hitSlop={8}
        >
          <MaterialIcons name={activeTab.iconName} size={24} color={palette.primary as string} />
          {activeTab.badgeCount && activeTab.badgeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: palette.danger as string }]}>
              <Animated.Text style={[styles.badgeText, { color: palette.onPrimary as string }]}>
                {activeTab.badgeCount > 99 ? "99+" : String(activeTab.badgeCount)}
              </Animated.Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: "50%",
    marginLeft: -EXPANDED_WIDTH / 2,
    height: EXPANDED_HEIGHT,
    borderRadius: BrandRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
    overflow: "hidden",
  },
  expandedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: BrandSpacing.sm,
    position: "absolute",
    inset: 0,
  },
  tabButton: {
    minWidth: 58,
    maxWidth: 74,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  compactWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    inset: 0,
  },
  compactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
});
