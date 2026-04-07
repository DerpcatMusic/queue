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

import { Motion } from "@/theme/theme";
import { ANIMATION_DURATION_TAB_CONTENT } from "./top-sheet-constants";

const TAB_CONTENT_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const TAB_SCENE_HIDDEN_OPACITY = 0;
const TAB_SCENE_FADE_OUT_DURATION = Motion.fast; // 140ms
const TAB_SCENE_FADE_IN_DELAY = Motion.staggerBase; // 40ms

export function useTabSceneTransitionStyle() {
  const isFocused = useIsFocused();
  const animatedOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    cancelAnimation(animatedOpacity);
    animatedOpacity.value = isFocused
      ? withDelay(
          TAB_SCENE_FADE_IN_DELAY,
          withTiming(1, {
            duration: ANIMATION_DURATION_TAB_CONTENT,
            easing: TAB_CONTENT_EASING,
          }),
        )
      : withTiming(TAB_SCENE_HIDDEN_OPACITY, {
          duration: TAB_SCENE_FADE_OUT_DURATION,
          easing: TAB_CONTENT_EASING,
        });
  }, [animatedOpacity, isFocused]);

  return useAnimatedStyle(() => {
    const scale = interpolate(animatedOpacity.value, [0, 1], [0.98, 1]);
    return {
      opacity: animatedOpacity.value,
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
