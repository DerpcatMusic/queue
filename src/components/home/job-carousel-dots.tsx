import Animated, { type SharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";
import { Spring } from "@/theme/theme";

const DOT_SIZE = BrandSpacing.statusDot;
const DOT_GAP = BrandSpacing.xs;

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
            damping: Spring.gentle.damping,
            stiffness: Spring.gentle.stiffness,
          }),
        },
      ],
      opacity: withSpring(isActive ? 1.0 : 0.35, {
        damping: Spring.gentle.damping,
        stiffness: Spring.gentle.stiffness,
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
    <Box
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: DOT_GAP,
      }}
      accessibilityRole="none"
    >
      {dots}
    </Box>
  );
}
