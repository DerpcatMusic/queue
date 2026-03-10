import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { useSystemUi, type InsetTone } from "@/contexts/system-ui-context";
import { BrandSpacing } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";

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
  const insets = useAppInsets();
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
      <SafeAreaView
        edges={["bottom"]}
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

  const {
    contentContainerStyle,
    scrollProps,
    style,
    children,
    useDesktopFrame = true,
  } = props;

  const content = useDesktopFrame ? (
    <DesktopDashboardFrame contentStyle={contentContainerStyle}>{children}</DesktopDashboardFrame>
  ) : (
    children
  );

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        {
          paddingBottom: Math.max(BrandSpacing.xl, insets.safeBottom + BrandSpacing.xl),
        },
        !useDesktopFrame ? contentContainerStyle : null,
      ]}
    >
      {content}
    </Animated.ScrollView>
  );
}
