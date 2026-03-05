import type { PropsWithChildren } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandSpacing } from "@/constants/brand";

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
  const insets = useSafeAreaInsets();

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
          paddingBottom: Math.max(BrandSpacing.lg, insets.bottom + BrandSpacing.md),
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </Animated.ScrollView>
  );
}
