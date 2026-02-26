import { BrandSpacing } from "@/constants/brand";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import { useTabBarScrollSignals } from "@/hooks/use-tab-bar-scroll-signals";
import type { PropsWithChildren } from "react";
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type Animated from "react-native-reanimated";
import type { AnimatedRef } from "react-native-reanimated";

type TabScreenContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

type TabScreenScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, "contentContainerStyle" | "contentInsetAdjustmentBehavior" | "ref"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    routeKey?: string;
    animatedRef?: AnimatedRef<Animated.ScrollView>;
  }
>;

export function TabScreenContainer({ children, style }: TabScreenContainerProps) {
  const { bottomInset } = useNativeTabLayout();

  return (
    <View style={[{ flex: 1, paddingBottom: bottomInset }, style]}>
      {children}
    </View>
  );
}

export function TabScreenScrollView({
  children,
  contentContainerStyle,
  routeKey,
  onScroll,
  animatedRef,
  style,
  scrollIndicatorInsets,
  ...props
}: TabScreenScrollViewProps) {
  const { bottomInset } = useNativeTabLayout();
  const tabBarSignals = useTabBarScrollSignals(routeKey ?? "unknown");

  const scrollProps = {
    ...props,
    style: [{ flex: 1 }, style],
    onScroll: (event: Parameters<NonNullable<ScrollViewProps["onScroll"]>>[0]) => {
      if (routeKey) {
        tabBarSignals.onScroll(event);
      }
      onScroll?.(event);
    },
    scrollEventThrottle: 16,
    contentInsetAdjustmentBehavior: "never" as const,
    scrollIndicatorInsets: {
      ...scrollIndicatorInsets,
      bottom:
        Math.max(
          scrollIndicatorInsets?.bottom ?? 0,
          bottomInset + BrandSpacing.sm,
        ),
    },
    contentContainerStyle: [
      {
        paddingTop: BrandSpacing.sm,
        paddingBottom: bottomInset + BrandSpacing.lg,
      },
      contentContainerStyle,
    ],
  };

  if (animatedRef) {
    const AnimatedScrollView = ScrollView as unknown as typeof Animated.ScrollView;
    const animatedScrollProps = scrollProps as ScrollViewProps;
    return (
      <AnimatedScrollView ref={animatedRef as never} {...animatedScrollProps}>
        {children}
      </AnimatedScrollView>
    );
  }

  return <ScrollView {...scrollProps}>{children}</ScrollView>;
}
