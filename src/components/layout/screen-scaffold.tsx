import type { PropsWithChildren } from "react";
import { cloneElement, isValidElement, useEffect } from "react";
import { View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import {
  useLayoutSheetHeight,
  useScrollSheetLayout,
} from "@/components/layout/scroll-sheet-provider";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { type InsetTone, useSystemUi } from "@/contexts/system-ui-context";
import { createSheetInsetStyle, getSheetProgressViewOffset } from "./sheet-inset-contract";

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
  sheetInsets?: ScreenScaffoldSheetInsets;
};

export type ScreenScaffoldProps = PropsWithChildren<
  ScrollScreenScaffoldProps | StaticScreenScaffoldProps
>;

export function ScreenScaffold(props: ScreenScaffoldProps) {
  const { setTopInsetTone } = useSystemUi();
  const topInsetTone = props.topInsetTone ?? "app";
  const layoutSheetHeight = useLayoutSheetHeight();
  const { safeBottom, setSceneViewportHeight } = useScrollSheetLayout();

  useEffect(() => {
    setTopInsetTone(topInsetTone);
    return () => {
      setTopInsetTone("app");
    };
  }, [setTopInsetTone, topInsetTone]);

  const staticTopBlockHeight =
    props.mode === "static" && props.sheetInsets
      ? props.sheetInsets.topSpacing ?? 0
      : 0;
  const staticHorizontalPadding =
    props.mode === "static" && props.sheetInsets?.horizontalPadding !== undefined
      ? props.sheetInsets.horizontalPadding
      : undefined;
  const staticBottomPadding =
    props.mode === "static" && props.sheetInsets?.bottomSpacing !== undefined
      ? props.sheetInsets.bottomSpacing
      : 0;
  const handleSceneLayout = ({
    nativeEvent: {
      layout: { height },
    },
  }: {
    nativeEvent: { layout: { height: number } };
  }) => {
    if (height <= 0) {
      return;
    }
    setSceneViewportHeight(height);
  };

  if (props.mode === "static") {
    return (
      <View
        onLayout={handleSceneLayout}
        style={[
          {
            flex: 1,
            borderRadius: 0,
          },
          props.style,
        ]}
      >
        <TabSceneTransition>
          <View style={{ flex: 1, borderRadius: 0 }}>
            {staticTopBlockHeight > 0 ? (
              <View style={{ height: staticTopBlockHeight, flexShrink: 0 }} />
            ) : null}
            <View
              style={[
                {
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                  paddingBottom: staticBottomPadding,
                  borderRadius: 0,
                },
                staticHorizontalPadding !== undefined
                  ? { paddingHorizontal: staticHorizontalPadding }
                  : null,
              ]}
            >
              {props.children}
            </View>
          </View>
        </TabSceneTransition>
      </View>
    );
  }

  const {
    contentContainerStyle,
    scrollProps,
    style,
    children,
    useDesktopFrame = true,
    sheetInsets,
  } = props;

  const resolvedSheetInsetStyle = sheetInsets
    ? createSheetInsetStyle({
        collapsedSheetHeight: layoutSheetHeight,
        safeBottom,
        topSpacing: sheetInsets.topSpacing,
        bottomSpacing: sheetInsets.bottomSpacing,
        horizontalPadding: sheetInsets.horizontalPadding,
      })
    : null;

  const resolvedContentContainerStyle = [contentContainerStyle, resolvedSheetInsetStyle];

  const refreshControl = scrollProps?.refreshControl;
  const resolvedRefreshControl =
    sheetInsets && isValidElement(refreshControl)
        ? cloneElement(refreshControl, {
          progressViewOffset: getSheetProgressViewOffset({
            collapsedSheetHeight: layoutSheetHeight,
            topSpacing: sheetInsets.topSpacing,
          }),
        })
      : refreshControl;

  const content = useDesktopFrame ? (
    <DesktopDashboardFrame contentStyle={resolvedContentContainerStyle}>
      {children}
    </DesktopDashboardFrame>
  ) : (
    children
  );

  return (
    <View onLayout={handleSceneLayout} style={{ flex: 1, borderRadius: 0 }}>
      <TabSceneTransition>
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
      </TabSceneTransition>
    </View>
  );
}
