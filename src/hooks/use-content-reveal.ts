import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Motion, Spring } from "@/theme/theme";

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
    springConfig?: (typeof Spring)[keyof typeof Spring];
    staggerIndex?: number;
    replayOnFocus?: boolean;
  } = {},
) {
  const {
    revealDuration = Motion.contentReveal,
    springConfig = Spring.standard,
    staggerIndex = 0,
    replayOnFocus = true,
  } = options;
  const isFocused = useIsFocused();

  // Shared value for content opacity
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.98); // subtle scale up

  useEffect(() => {
    const shouldReveal = !isLoading && (!replayOnFocus || isFocused);
    if (shouldReveal) {
      // Content loaded - animate in with stagger
      contentOpacity.value = withTiming(1, { duration: revealDuration });
      contentScale.value = withTiming(1, { duration: revealDuration + 50 });
    } else {
      contentOpacity.value = 0;
      contentScale.value = 0.98;
    }
  }, [contentOpacity, contentScale, isFocused, isLoading, replayOnFocus, revealDuration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  return {
    isLoading,
    animatedStyle,
    // For use with Animated.View
    entering: FadeIn.delay(staggerIndex * Motion.staggerBase)
      .springify()
      .damping(springConfig.damping),
  };
}

/**
 * For list items - returns consistent stagger based on index
 */
export function useListItemAnimation(index: number) {
  return {
    entering: FadeIn.delay(Math.min(index, 8) * Motion.staggerBase)
      .springify()
      .damping(Spring.standard.damping),
  };
}
