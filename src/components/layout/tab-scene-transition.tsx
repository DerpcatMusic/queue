import { useIsFocused } from "@react-navigation/native";
import { type PropsWithChildren, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import {
  ANIMATION_DURATION_TAB_CONTENT,
  TAB_CONTENT_INACTIVE_OPACITY,
  TAB_CONTENT_INACTIVE_SCALE,
} from "./top-sheet-constants";

export function useTabSceneTransitionStyle() {
  const isFocused = useIsFocused();
  const animatedFocusProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    animatedFocusProgress.value = withTiming(isFocused ? 1 : 0, {
      duration: ANIMATION_DURATION_TAB_CONTENT,
    });
  }, [animatedFocusProgress, isFocused]);

  return useAnimatedStyle(() => {
    const progress = animatedFocusProgress.value;
    const opacity = TAB_CONTENT_INACTIVE_OPACITY + (1 - TAB_CONTENT_INACTIVE_OPACITY) * progress;
    const scale = TAB_CONTENT_INACTIVE_SCALE + (1 - TAB_CONTENT_INACTIVE_SCALE) * progress;

    return {
      opacity,
      transform: [{ scale }],
    };
  });
}

export function TabSceneTransition({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const transitionStyle = useTabSceneTransitionStyle();

  return <Animated.View style={[{ flex: 1 }, transitionStyle, style]}>{children}</Animated.View>;
}
