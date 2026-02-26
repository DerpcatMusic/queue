import { BrandSpacing } from "@/constants/brand";
import type { PropsWithChildren } from "react";
import {
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export type TabScreenRootProps = PropsWithChildren<TabScreenRootScrollProps | TabScreenRootStaticProps>;

export function TabScreenRoot(props: TabScreenRootProps) {
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        {
          paddingBottom: BrandSpacing.lg,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
