import { View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTheme } from "@/hooks/use-theme";

const DOT_SIZE = 6;
const DOT_GAP = 4;

type JobCarouselDotsProps = {
  count: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
};

function Dot({
  index,
  scrollX,
  cardWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
}) {
  const { color: palette } = useTheme();
  const isActiveStyle = useAnimatedStyle(() => {
    "worklet";
    const page = scrollX.value / cardWidth;
    const isActive = Math.round(page) === index;
    return {
      transform: [
        {
          scale: withSpring(isActive ? 1.35 : 1.0, {
            damping: 18,
            stiffness: 300,
          }),
        },
      ],
      opacity: withSpring(isActive ? 1.0 : 0.35, {
        damping: 20,
        stiffness: 250,
      }),
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: palette.primary,
        },
        isActiveStyle,
      ]}
    />
  );
}

export function JobCarouselDots({ count, scrollX, cardWidth }: JobCarouselDotsProps) {
  if (count <= 1) {
    return null;
  }

  const dots = [];
  for (let i = 0; i < count; i++) {
    dots.push(<Dot key={i} index={i} scrollX={scrollX} cardWidth={cardWidth} />);
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: DOT_GAP,
      }}
      accessibilityRole="none"
    >
      {dots}
    </View>
  );
}
