import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Motion } from "@/theme/theme";

/**
 * Hook for smooth skeleton → content transition.
 *
 * @param isLoading - whether content is still loading
 * @param options - configure reveal animation
 */
export function useContentReveal(
  isLoading: boolean,
  options: {
    revealDuration?: number;
    staggerIndex?: number;
    replayOnFocus?: boolean;
  } = {},
) {
  const { revealDuration = Motion.contentReveal, staggerIndex = 0, replayOnFocus = true } = options;
  const isFocused = useIsFocused();

  // Shared value for content opacity — pure fade, no scale pop
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    const shouldReveal = !isLoading && (!replayOnFocus || isFocused);
    if (shouldReveal) {
      // Content loaded - fade in elegantly
      contentOpacity.value = withTiming(1, {
        duration: revealDuration,
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      contentOpacity.value = 0;
    }
  }, [contentOpacity, isFocused, isLoading, replayOnFocus, revealDuration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return {
    isLoading,
    animatedStyle,
    // For use with Animated.View — fade in with stagger, no spring
    entering: FadeIn.delay(staggerIndex * Motion.staggerBase)
      .duration(revealDuration)
      .easing(Easing.inOut(Easing.ease)),
  };
}

/**
 * For list items - returns consistent stagger based on index
 */
export function useListItemAnimation(index: number) {
  return {
    entering: FadeIn.delay(Math.min(index, 8) * Motion.staggerBase)
      .duration(Motion.contentReveal)
      .easing(Easing.inOut(Easing.ease)),
  };
}
