import { View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import type { BrandPalette } from "@/constants/brand";

const DOT_SIZE = 6;
const DOT_GAP = 4;

type JobCarouselDotsProps = {
  count: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
  palette: BrandPalette;
};

function Dot({
  index,
  scrollX,
  cardWidth,
  palette,
}: {
  index: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
  palette: BrandPalette;
}) {
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
          backgroundColor: palette.primary as string,
        },
        isActiveStyle,
      ]}
    />
  );
}

export function JobCarouselDots({ count, scrollX, cardWidth, palette }: JobCarouselDotsProps) {
  if (count <= 1) {
    return null;
  }

  const dots = [];
  for (let i = 0; i < count; i++) {
    dots.push(<Dot key={i} index={i} scrollX={scrollX} cardWidth={cardWidth} palette={palette} />);
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
