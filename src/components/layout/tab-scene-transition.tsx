import { useIsFocused } from "@react-navigation/native";
import { type PropsWithChildren, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";
import { Motion } from "@/theme/theme";
import { ANIMATION_DURATION_TAB_CONTENT } from "./top-sheet-constants";

// Elegant fade + subtle scale + subtle rise.
// Content fades in smoothly while gently growing and floating up.
// Gentle ease-in-out — no spring, no bounce, no pop.
const TAB_SCENE_SCALE_HIDDEN = 0.97; // subtle, not aggressive
const TAB_SCENE_TRANSLATE_Y_HIDDEN = 4; // pixels — gentle float up
const TAB_SCENE_FADE_OUT_DURATION = Motion.fast; // 140ms
const TAB_SCENE_FADE_IN_DELAY = Motion.staggerBase; // 40ms
const TAB_ENTER_EASING = Easing.bezier(0.4, 0, 0.2, 1); // ease-in-out-ish, smooth
const TAB_EXIT_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export function useTabSceneTransitionStyle() {
  const isFocused = useIsFocused();
  const animatedProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    cancelAnimation(animatedProgress);
    animatedProgress.value = isFocused
      ? withDelay(
          TAB_SCENE_FADE_IN_DELAY,
          withTiming(1, {
            duration: ANIMATION_DURATION_TAB_CONTENT + 60, // 240ms — slightly slower
            easing: TAB_ENTER_EASING,
          }),
        )
      : withTiming(0, {
          duration: TAB_SCENE_FADE_OUT_DURATION,
          easing: TAB_EXIT_EASING,
        });
  }, [animatedProgress, isFocused]);

  return useAnimatedStyle(() => {
    const opacity = animatedProgress.value;
    const scale = interpolate(animatedProgress.value, [0, 1], [TAB_SCENE_SCALE_HIDDEN, 1]);
    const translateY = interpolate(
      animatedProgress.value,
      [0, 1],
      [TAB_SCENE_TRANSLATE_Y_HIDDEN, 0],
    );
    return {
      opacity,
      transform: [{ scale }, { translateY }],
    };
  });
}

export function TabSceneTransition({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  const transitionStyle = useTabSceneTransitionStyle();

  return (
    <Animated.View
      style={[{ flex: 1, backgroundColor: theme.color.appBg }, transitionStyle, style]}
    >
      {children}
    </Animated.View>
  );
}
