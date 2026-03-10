import type { PropsWithChildren } from "react";
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { AnimatedRef } from "react-native-reanimated";
import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { ScreenScaffold } from "@/components/layout/screen-scaffold";
import type { InsetTone } from "@/contexts/system-ui-context";

type TabScreenContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

type TabScreenScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, "contentContainerStyle" | "contentInsetAdjustmentBehavior" | "ref"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    animatedRef?: AnimatedRef<Animated.ScrollView>;
    topInsetTone?: InsetTone;
    useDesktopFrame?: boolean;
  }
>;

export function TabScreenContainer({ children, style }: TabScreenContainerProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <ScreenScaffold mode="static">
        <DesktopDashboardFrame>{children}</DesktopDashboardFrame>
      </ScreenScaffold>
    </View>
  );
}

export function TabScreenScrollView({
  children,
  contentContainerStyle,
  onScroll,
  animatedRef,
  style,
  scrollIndicatorInsets,
  topInsetTone,
  useDesktopFrame,
  ...props
}: TabScreenScrollViewProps) {
  return (
    <ScreenScaffold
      mode="scroll"
      style={style}
      contentContainerStyle={contentContainerStyle}
      {...(topInsetTone ? { topInsetTone } : {})}
      {...(useDesktopFrame !== undefined ? { useDesktopFrame } : {})}
      scrollProps={{
        ...props,
        ...(animatedRef ? { ref: animatedRef as never } : {}),
        onScroll,
        scrollEventThrottle: 32,
        scrollIndicatorInsets,
      }}
    >
      {children}
    </ScreenScaffold>
  );
}
