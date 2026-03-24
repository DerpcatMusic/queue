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
import { BrandSpacing } from "@/constants/brand";
import { useKitTheme } from "./use-kit-theme";

type BurstBubbleConfig = {
  id: string;
  x: number;
  y: number;
  size: number;
};

const BUBBLES: readonly BurstBubbleConfig[] = [
  {
    id: "left-top",
    x: -BrandSpacing.xxl * 2 - 4,
    y: -BrandSpacing.md - 4,
    size: BrandSpacing.sm + 2,
  },
  {
    id: "right-top",
    x: BrandSpacing.xxl * 2 - 2,
    y: -BrandSpacing.md - 6,
    size: BrandSpacing.sm + 4,
  },
  {
    id: "left-bottom",
    x: -BrandSpacing.xxl - 2,
    y: BrandSpacing.lg + 12,
    size: BrandSpacing.xs + 4,
  },
  {
    id: "right-bottom",
    x: BrandSpacing.xxl - 2,
    y: BrandSpacing.lg + 10,
    size: BrandSpacing.sm + 2,
  },
  { id: "top", x: 0, y: -BrandSpacing.xxl * 2 + 2, size: BrandSpacing.xs + 5 },
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
    transform: [
      { translateX: burst.value * x },
      { translateY: burst.value * y },
      { scale: 0.75 + burst.value * 0.45 },
    ],
  }));

  return (
    <Animated.View
      className="absolute rounded-full"
      style={[
        {
          width: size,
          height: size,
          backgroundColor: color,
        },
        bubbleStyle,
      ]}
    />
  );
}

export function KitSuccessBurst({
  iconName = "checkmark.circle.fill",
  height = BrandSpacing.xxl * 4 + 16,
}: KitSuccessBurstProps) {
  const { color, background } = useKitTheme();
  const badgeScale = useSharedValue(0.7);
  const ringScale = useSharedValue(0.75);
  const burst = useSharedValue(0);

  useEffect(() => {
    badgeScale.value = withSequence(
      withTiming(1.14, { duration: 220 }),
      withSpring(1, { damping: 11, stiffness: 220 }),
    );
    ringScale.value = withSequence(
      withTiming(1.35, { duration: 620 }),
      withTiming(1.45, { duration: 60 }),
    );
    burst.value = withTiming(1, { duration: 760 });
  }, [badgeScale, burst, ringScale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    borderWidth: 2 + burst.value,
  }));

  return (
    <View className="items-center justify-center" style={{ height }}>
      <Animated.View
        className="absolute rounded-full"
        style={[
          {
            width: BrandSpacing.iconContainer + BrandSpacing.xxl,
            height: BrandSpacing.iconContainer + BrandSpacing.xxl,
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
        className="items-center justify-center rounded-full"
        style={[
          {
            width: BrandSpacing.xxl + 8,
            height: BrandSpacing.xxl + 8,
            backgroundColor: background.primarySubtle as string,
            borderWidth: 1,
            borderColor: color.success as string,
          },
          badgeStyle,
        ]}
      >
        <AppSymbol name={iconName} size={BrandSpacing.lg + 6} tintColor={color.success as string} />
      </Animated.View>
    </View>
  );
}
