import { useEffect } from "react";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { BorderWidth, IconSize } from "@/lib/design-system";
import { Box } from "@/primitives";
import { useKitTheme } from "./use-kit-theme";

type BurstBubbleConfig = {
  id: string;
  x: number;
  y: number;
  size: number;
};

// Artistic constants: These decorative bubble positions, sizes, and animation timings
// are specific to this success burst animation's choreography. They don't map to
// generic design tokens because they define the unique character of this animation.
const BUBBLES: readonly BurstBubbleConfig[] = [
  { id: "left-top", x: -48, y: -12, size: 10 },
  { id: "right-top", x: 46, y: -18, size: 12 },
  { id: "left-bottom", x: -34, y: 28, size: 8 },
  { id: "right-bottom", x: 38, y: 26, size: 10 },
  { id: "top", x: 0, y: -42, size: 9 },
] as const;

const BurstMotion = {
  badgePop: 220,
  badgeSpringDamping: 11,
  badgeSpringStiffness: 220,
  ringExpand: 120,
  ringFade: 540,
  ringPulse: 620,
  ringPulseOvershoot: 60,
  burstTravel: 760,
} as const;

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
          borderRadius: BrandRadius.pill,
          backgroundColor: color,
        },
        bubbleStyle,
      ]}
    />
  );
}

export function KitSuccessBurst({
  iconName = "checkmark.circle.fill",
  height = BrandSpacing.successBurstHeight,
}: KitSuccessBurstProps) {
  const { color, background } = useKitTheme();
  const badgeScale = useSharedValue(0.7);
  const ringScale = useSharedValue(0.75);
  const ringWidth = useSharedValue(1);
  const burst = useSharedValue(0);

  useEffect(() => {
    badgeScale.value = withSequence(
      withTiming(1.14, { duration: BurstMotion.badgePop }),
      withSpring(1, {
        damping: BurstMotion.badgeSpringDamping,
        stiffness: BurstMotion.badgeSpringStiffness,
      }),
    );
    ringWidth.value = withSequence(
      withTiming(4, { duration: BurstMotion.ringExpand }),
      withTiming(1, { duration: BurstMotion.ringFade }),
    );
    ringScale.value = withSequence(
      withTiming(1.35, { duration: BurstMotion.ringPulse }),
      withTiming(1.45, { duration: BurstMotion.ringPulseOvershoot }),
    );
    burst.value = withTiming(1, { duration: BurstMotion.burstTravel });
  }, [badgeScale, burst, ringScale, ringWidth]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderWidth: ringWidth.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <Box style={{ height, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: BrandSpacing.successBurstRing,
            height: BrandSpacing.successBurstRing,
            borderRadius: BrandRadius.pill,
            borderWidth: BorderWidth.heavy,
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
            width: BrandSpacing.successBurstBadge,
            height: BrandSpacing.successBurstBadge,
            borderRadius: BrandRadius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: background.primarySubtle as string,
            borderWidth: BorderWidth.thin,
            borderColor: color.success as string,
          },
          badgeStyle,
        ]}
      >
        <AppSymbol
          name={iconName}
          size={IconSize.successBurst}
          tintColor={color.success as string}
        />
      </Animated.View>
    </Box>
  );
}
