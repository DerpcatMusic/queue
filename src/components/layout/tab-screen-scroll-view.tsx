import type { PropsWithChildren } from "react";
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { AnimatedRef } from "react-native-reanimated";
import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import type { InsetTone } from "@/contexts/system-ui-context";
import type { ScreenScaffoldSheetInsets } from "./screen-scaffold";

type TabScreenContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

type TabScreenScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, "contentContainerStyle" | "contentInsetAdjustmentBehavior" | "ref"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    routeKey?: string;
    animatedRef?: AnimatedRef<Animated.ScrollView>;
    topInsetTone?: InsetTone;
    useDesktopFrame?: boolean;
    sheetInsets?: ScreenScaffoldSheetInsets;
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
  onScroll,
  animatedRef,
  style,
  scrollIndicatorInsets,
  topInsetTone,
  useDesktopFrame,
  sheetInsets,
  ...props
}: TabScreenScrollViewProps) {
  return (
    <TabScreenRoot
      mode="scroll"
      style={style}
      contentContainerStyle={contentContainerStyle}
      {...(topInsetTone ? { topInsetTone } : {})}
      {...(useDesktopFrame !== undefined ? { useDesktopFrame } : {})}
      {...(sheetInsets ? { sheetInsets } : {})}
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
