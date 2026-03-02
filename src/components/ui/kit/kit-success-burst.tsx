import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AppSymbol } from "@/components/ui/app-symbol";
import { useKitTheme } from "./use-kit-theme";

type BurstBubbleConfig = {
  id: string;
  x: number;
  y: number;
  size: number;
};

const BUBBLES: readonly BurstBubbleConfig[] = [
  { id: "left-top", x: -48, y: -12, size: 10 },
  { id: "right-top", x: 46, y: -18, size: 12 },
  { id: "left-bottom", x: -34, y: 28, size: 8 },
  { id: "right-bottom", x: 38, y: 26, size: 10 },
  { id: "top", x: 0, y: -42, size: 9 },
] as const;

type KitSuccessBurstProps = {
  iconName?: string;
  height?: number;
};

function BurstBubble({
  burst,
  x,
  y,
  size,
  color,
}: {
  burst: SharedValue<number>;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: 1 - burst.value,
    transform: [
      { translateX: burst.value * x },
      { translateY: burst.value * y },
      { scale: 0.5 + burst.value * 0.9 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: color,
        },
        bubbleStyle,
      ]}
    />
  );
}

export function KitSuccessBurst({
  iconName = "checkmark.circle.fill",
  height = 112,
}: KitSuccessBurstProps) {
  const { color, background } = useKitTheme();
  const badgeScale = useSharedValue(0.7);
  const ringScale = useSharedValue(0.75);
  const ringOpacity = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    badgeScale.value = withSequence(
      withTiming(1.14, { duration: 220 }),
      withSpring(1, { damping: 11, stiffness: 220 }),
    );
    ringOpacity.value = withSequence(
      withTiming(0.55, { duration: 120 }),
      withTiming(0, { duration: 540 }),
    );
    ringScale.value = withSequence(
      withTiming(1.35, { duration: 620 }),
      withTiming(1.45, { duration: 60 }),
    );
    burst.value = withTiming(1, { duration: 760 });
  }, [badgeScale, burst, ringOpacity, ringScale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={{ height, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 72,
            height: 72,
            borderRadius: 999,
            borderWidth: 3,
            borderColor: color.success as string,
          },
          ringStyle,
        ]}
      />

      {BUBBLES.map((bubble, index) => (
        <BurstBubble
          key={bubble.id}
          burst={burst}
          x={bubble.x}
          y={bubble.y}
          size={bubble.size}
          color={index % 2 === 0 ? (color.success as string) : (color.primary as string)}
        />
      ))}

      <Animated.View
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: background.primarySubtle as string,
            borderWidth: 1,
            borderColor: color.success as string,
          },
          badgeStyle,
        ]}
      >
        <AppSymbol name={iconName} size={34} tintColor={color.success as string} />
      </Animated.View>
    </View>
  );
}
