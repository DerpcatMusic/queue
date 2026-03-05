import type { PropsWithChildren } from "react";
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { AnimatedRef } from "react-native-reanimated";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useTabBarScrollSignals } from "@/hooks/use-tab-bar-scroll-signals";

type TabScreenContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

type TabScreenScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, "contentContainerStyle" | "contentInsetAdjustmentBehavior" | "ref"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    routeKey: string;
    animatedRef?: AnimatedRef<Animated.ScrollView>;
  }
>;

export function TabScreenContainer({ children, style }: TabScreenContainerProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <TabScreenRoot mode="static">{children}</TabScreenRoot>
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
  const tabBarSignals = useTabBarScrollSignals(routeKey);

  return (
    <TabScreenRoot
      mode="scroll"
      style={style}
      contentContainerStyle={contentContainerStyle}
      scrollProps={{
        ...props,
        ...(animatedRef ? { ref: animatedRef as never } : {}),
        onScroll: (event) => {
          tabBarSignals.onScroll(event);
          onScroll?.(event);
        },
        scrollEventThrottle: 32,
        scrollIndicatorInsets,
      }}
    >
      {children}
    </TabScreenRoot>
  );
}
