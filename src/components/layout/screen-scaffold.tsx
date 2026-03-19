import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { type InsetTone, useSystemUi } from "@/contexts/system-ui-context";

type BaseScreenScaffoldProps = {
  style?: StyleProp<ViewStyle>;
  topInsetTone?: InsetTone;
};

type ScrollScreenScaffoldProps = BaseScreenScaffoldProps & {
  mode: "scroll";
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
  contentContainerStyle?: StyleProp<ViewStyle>;
  useDesktopFrame?: boolean;
};

type StaticScreenScaffoldProps = BaseScreenScaffoldProps & {
  mode: "static";
};

export type ScreenScaffoldProps = PropsWithChildren<
  ScrollScreenScaffoldProps | StaticScreenScaffoldProps
>;

export function ScreenScaffold(props: ScreenScaffoldProps) {
  const { setTopInsetTone } = useSystemUi();
  const topInsetTone = props.topInsetTone ?? "app";

  useEffect(() => {
    setTopInsetTone(topInsetTone);
    return () => {
      setTopInsetTone("app");
    };
  }, [setTopInsetTone, topInsetTone]);

  if (props.mode === "static") {
    return (
      <View
        style={[
          {
            flex: 1,
          },
          props.style,
        ]}
      >
        {props.children}
      </View>
    );
  }

  const { contentContainerStyle, scrollProps, style, children, useDesktopFrame = true } = props;

  const content = useDesktopFrame ? (
    <DesktopDashboardFrame contentStyle={contentContainerStyle}>{children}</DesktopDashboardFrame>
  ) : (
    children
  );

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={!useDesktopFrame ? contentContainerStyle : undefined}
    >
      {content}
    </Animated.ScrollView>
  );
}
