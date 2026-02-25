import { BrandSpacing } from "@/constants/brand";
import { useTabBarScrollSignals } from "@/hooks/use-tab-bar-scroll-signals";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import type { PropsWithChildren } from "react";
import { ScrollView, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";

type TabScreenScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, "contentContainerStyle" | "contentInsetAdjustmentBehavior"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    routeKey?: string;
  }
>;

export function TabScreenScrollView({
  children,
  contentContainerStyle,
  routeKey,
  onScroll,
  ...props
}: TabScreenScrollViewProps) {
  const { topInset } = useNativeTabLayout();
  const tabBarSignals = useTabBarScrollSignals(routeKey ?? "unknown");

  return (
    <ScrollView
      {...props}
      onScroll={(event) => {
        if (routeKey) {
          tabBarSignals.onScroll(event);
        }
        onScroll?.(event);
      }}
      scrollEventThrottle={16}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        {
          paddingTop: Math.max(topInset, BrandSpacing.sm),
          paddingBottom: BrandSpacing.lg,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
