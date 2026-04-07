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

// Mercury-style: content fades in while growing from small + rising up.
// Scale: 0.94 → 1.0 (noticeable grow effect)
// TranslateY: 8px → 0 (rises into place)
// Spring config: gentle overshoot for premium feel
const TAB_SCENE_SCALE_HIDDEN = 0.94;
const TAB_SCENE_TRANSLATE_Y_HIDDEN = 8; // pixels — content "rises" into place
const TAB_SCENE_FADE_OUT_DURATION = Motion.fast; // 140ms
const TAB_SCENE_FADE_IN_DELAY = Motion.staggerBase; // 40ms

// Spring-like easing for enter (gentle overshoot feel without actual overshoot)
const TAB_ENTER_EASING = Easing.bezier(0.34, 1.56, 0.64, 1); // slight overshoot feel
const TAB_EXIT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

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

  return useAnimatedStyle(() => {
    const scale = interpolate(animatedProgress.value, [0, 1], [TAB_SCENE_SCALE_HIDDEN, 1]);
    const translateY = interpolate(
      animatedProgress.value,
      [0, 1],
      [TAB_SCENE_TRANSLATE_Y_HIDDEN, 0],
    );
    return {
      opacity: animatedProgress.value,
      transform: [{ scale }, { translateY }],
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
