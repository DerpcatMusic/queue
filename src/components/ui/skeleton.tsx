import type { ReactNode } from "react";
import { useEffect } from "react";
import { type DimensionValue, View } from "react-native";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { HStack, VStack } from "@/primitives/stack";

// ============================================================
// Types
// ============================================================

export type SkeletonLineProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

export type SkeletonCardProps = {
  avatarSize?: number;
  lines?: number;
};

export type SkeletonShimmerProps = {
  children: ReactNode;
  isLoading: boolean;
};

// ============================================================
// SkeletonShimmer - wraps content with shimmer overlay
// ============================================================

function SkeletonShimmer({ children, isLoading }: SkeletonShimmerProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800 }),
      -1, // infinite
      true, // reverse
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!isLoading) return <>{children}</>;

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

// ============================================================
// SkeletonLine - single line placeholder
// ============================================================

export function SkeletonLine({
  width = "100%",
  height = BrandSpacing.md,
  radius = BrandRadius.sm,
}: SkeletonLineProps) {
  const { color } = useTheme();

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: color.surfaceMuted,
      }}
    />
  );
}

// ============================================================
// SkeletonCard - card-shaped placeholder
// ============================================================

function ContentLines({ count }: { count: number }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(
      <SkeletonLine
        key={`content-line-${i}`}
        width={i === count - 1 ? "70%" : "100%"}
        height={12}
      />,
    );
  }
  return <>{items}</>;
}

export function SkeletonCard({ avatarSize = BrandSpacing.avatarMd, lines = 3 }: SkeletonCardProps) {
  return (
    <View style={{ gap: BrandSpacing.md, padding: BrandSpacing.lg }}>
      {/* Header with avatar */}
      <HStack gap="md" align="start">
        <SkeletonLine width={avatarSize} height={avatarSize} radius={BrandRadius.cardSubtle} />
        <View style={{ flex: 1 }}>
          <VStack gap="xs">
            <SkeletonLine width="60%" height={14} />
            <SkeletonLine width="40%" height={12} />
          </VStack>
        </View>
      </HStack>
      {/* Content lines */}
      <ContentLines count={lines} />
    </View>
  );
}

// ============================================================
// Exports
// ============================================================

export { SkeletonShimmer };
