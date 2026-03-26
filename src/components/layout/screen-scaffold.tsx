import type { PropsWithChildren } from "react";
import { cloneElement, isValidElement, useEffect } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import { useScrollSheetLayout } from "@/components/layout/scroll-sheet-provider";
import { type InsetTone, useSystemUi } from "@/contexts/system-ui-context";

export type ScreenScaffoldSheetInsets = {
  topSpacing?: number;
  bottomSpacing?: number;
  horizontalPadding?: number;
};

type BaseScreenScaffoldProps = {
  style?: StyleProp<ViewStyle>;
  topInsetTone?: InsetTone;
};

type ScrollScreenScaffoldProps = BaseScreenScaffoldProps & {
  mode: "scroll";
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
  contentContainerStyle?: StyleProp<ViewStyle>;
  useDesktopFrame?: boolean;
  sheetInsets?: ScreenScaffoldSheetInsets;
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

  const { collapsedSheetHeight, safeBottom } = useScrollSheetLayout();
  const {
    contentContainerStyle,
    scrollProps,
    style,
    children,
    useDesktopFrame = true,
    sheetInsets,
  } = props;

  const resolvedContentContainerStyle = [
    sheetInsets
      ? {
          paddingTop: collapsedSheetHeight + (sheetInsets.topSpacing ?? 0),
          paddingBottom: safeBottom + (sheetInsets.bottomSpacing ?? 0),
          ...(sheetInsets.horizontalPadding !== undefined
            ? { paddingHorizontal: sheetInsets.horizontalPadding }
            : {}),
        }
      : null,
    contentContainerStyle,
  ];

  const refreshControl = scrollProps?.refreshControl;
  const resolvedRefreshControl =
    sheetInsets && isValidElement(refreshControl)
      ? cloneElement(refreshControl, {
          progressViewOffset: collapsedSheetHeight,
        })
      : refreshControl;

  const content = useDesktopFrame ? (
    <DesktopDashboardFrame contentStyle={resolvedContentContainerStyle}>{children}</DesktopDashboardFrame>
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
      refreshControl={resolvedRefreshControl}
      contentContainerStyle={!useDesktopFrame ? resolvedContentContainerStyle : undefined}
    >
      {content}
    </Animated.ScrollView>
  );
}
