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

import { ANIMATION_DURATION_TAB_CONTENT } from "./top-sheet-constants";

const TAB_CONTENT_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const TAB_SCENE_HIDDEN_OPACITY = 0;
const TAB_SCENE_FADE_OUT_DURATION = 96;
const TAB_SCENE_FADE_IN_DELAY = 60;

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
    return {
      opacity: animatedOpacity.value,
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
