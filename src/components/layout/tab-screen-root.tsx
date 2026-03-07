import type { PropsWithChildren } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { BrandSpacing } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";

type BaseProps = {
  style?: StyleProp<ViewStyle>;
};

type TabScreenRootScrollProps = BaseProps & {
  mode: "scroll";
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type TabScreenRootStaticProps = BaseProps & {
  mode: "static";
};

export type TabScreenRootProps = PropsWithChildren<
  TabScreenRootScrollProps | TabScreenRootStaticProps
>;

export function TabScreenRoot(props: TabScreenRootProps) {
  const insets = useAppInsets();

  if (props.mode === "static") {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[
          {
            flex: 1,
          },
          props.style,
        ]}
      >
        {props.children}
      </SafeAreaView>
    );
  }

  const { contentContainerStyle, scrollProps, style, children } = props;

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        {
          paddingBottom: Math.max(BrandSpacing.lg, insets.tabContentBottom + BrandSpacing.md),
        },
      ]}
    >
      <DesktopDashboardFrame contentStyle={contentContainerStyle}>{children}</DesktopDashboardFrame>
    </Animated.ScrollView>
  );
}
