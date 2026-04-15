import { useContext, type PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { View } from "react-native";

import { TabTransitionContext } from "@/modules/navigation/role-tabs-layout";

// Coordinated fade + scale with TabTransitionVeil
// When veil fades OUT (progress 0→1), scene scales IN (0→1) simultaneously
// Scale: 0.97 → 1.0 as it fades in (bigger), reverse on fade out
const TAB_SCENE_SCALE_HIDDEN = 0.97;
const TAB_SCENE_DURATION = 260;

export function TabSceneTransition({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const tabTransition = useContext(TabTransitionContext);

  const animatedStyle = useAnimatedStyle(() => {
    const progress = tabTransition?.focusProgress?.value ?? 1;

    return {
      opacity: withTiming(progress, {
        duration: TAB_SCENE_DURATION,
        easing: Easing.out(Easing.ease),
      }),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [TAB_SCENE_SCALE_HIDDEN, 1]),
        },
      ],
    };
  });

  return (
    <View style={[{ flex: 1 }, style]} pointerEvents="box-none">
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
    </View>
  );
}
