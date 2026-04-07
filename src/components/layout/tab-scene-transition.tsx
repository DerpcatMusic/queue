import { useIsFocused } from "@react-navigation/native";
import { type PropsWithChildren, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Motion } from "@/theme/theme";
import { ANIMATION_DURATION_TAB_CONTENT } from "./top-sheet-constants";

// Elegant fade in + out. No scale pop, no bounce.
// Content just fades smoothly in and out on tab switch.
// Opacity: 0 → 1 (ease-in-out, 180ms, 40ms delay)
const TAB_SCENE_FADE_OUT_DURATION = Motion.fast; // 140ms
const TAB_SCENE_FADE_IN_DELAY = Motion.staggerBase; // 40ms
const TAB_ENTER_EASING = Easing.inOut(Easing.ease);
const TAB_EXIT_EASING = Easing.inOut(Easing.ease);

export function useTabSceneTransitionStyle() {
  const isFocused = useIsFocused();
  const animatedProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    cancelAnimation(animatedProgress);
    animatedProgress.value = isFocused
      ? withDelay(
          TAB_SCENE_FADE_IN_DELAY,
          withTiming(1, {
            duration: ANIMATION_DURATION_TAB_CONTENT,
            easing: TAB_ENTER_EASING,
          }),
        )
      : withTiming(0, {
          duration: TAB_SCENE_FADE_OUT_DURATION,
          easing: TAB_EXIT_EASING,
        });
  }, [animatedProgress, isFocused]);

  // Pure fade — no scale, no translateY. Elegant and clean.
  return useAnimatedStyle(() => ({
    opacity: animatedProgress.value,
  }));
}

export function TabSceneTransition({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const transitionStyle = useTabSceneTransitionStyle();

  return <Animated.View style={[{ flex: 1 }, transitionStyle, style]}>{children}</Animated.View>;
}
