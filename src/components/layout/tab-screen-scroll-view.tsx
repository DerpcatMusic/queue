import type { PropsWithChildren } from "react";
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { AnimatedRef } from "react-native-reanimated";
import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";

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
      <TabScreenRoot mode="static">
        <DesktopDashboardFrame>{children}</DesktopDashboardFrame>
      </TabScreenRoot>
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
  void routeKey;

  return (
    <TabScreenRoot
      mode="scroll"
      style={style}
      contentContainerStyle={contentContainerStyle}
      scrollProps={{
        ...props,
        ...(animatedRef ? { ref: animatedRef as never } : {}),
        onScroll,
        scrollEventThrottle: 32,
        scrollIndicatorInsets,
      }}
    >
      {children}
    </TabScreenRoot>
  );
}
