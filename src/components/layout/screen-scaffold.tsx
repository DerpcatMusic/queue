import type { PropsWithChildren, ReactElement } from "react";
import React, { useContext, useEffect, useMemo } from "react";
import type { RefreshControlProps, ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { DesktopDashboardFrame } from "@/components/layout/desktop-dashboard-frame";
import {
  LayoutInsetsContext,
  ScrollSheetLayoutContext,
} from "@/components/layout/scroll-sheet-provider";
import { type InsetTone, useSystemUi } from "@/contexts/system-ui-context";

type BaseScreenScaffoldProps = {
  style?: StyleProp<ViewStyle>;
  topInsetTone?: InsetTone;
};

type ScrollScreenScaffoldProps = BaseScreenScaffoldProps & {
  mode: "scroll";
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle" | "refreshControl"> & {
    refreshControl?: ReactElement<RefreshControlProps>;
  };
  contentContainerStyle?: StyleProp<ViewStyle>;
  useDesktopFrame?: boolean;
  children?: React.ReactNode;
};

type StaticScreenScaffoldProps = BaseScreenScaffoldProps & {
  mode: "static";
  children?: React.ReactNode;
};

export type ScreenScaffoldProps = PropsWithChildren<
  ScrollScreenScaffoldProps | StaticScreenScaffoldProps
>;

export function ScreenScaffold(props: ScreenScaffoldProps) {
  const { setTopInsetTone } = useSystemUi();
  const topInsetTone = props.topInsetTone ?? "app";

  // Read inset values from context (sourced once at ScrollSheetProvider)
  const layoutInsets = useContext(LayoutInsetsContext);
  const sheetLayout = useContext(ScrollSheetLayoutContext);

  // Compute automatic inset values
  const collapsedSheetHeight = sheetLayout?.collapsedSheetHeight ?? 140;
  const safeBottom = layoutInsets?.safeBottom ?? 0;

  // Pre-compute scroll mode values (hooks called unconditionally)
  const isScrollMode = props.mode === "scroll";
  const scrollProps = isScrollMode ? (props as ScrollScreenScaffoldProps).scrollProps : undefined;
  const scrollPropsWithRefresh = useMemo(() => {
    if (!scrollProps?.refreshControl) return scrollProps;
    return {
      ...scrollProps,
      refreshControl: undefined,
    };
  }, [scrollProps]);

  const refreshControlElement = useMemo(() => {
    if (!scrollProps?.refreshControl) return undefined;
    const original = scrollProps.refreshControl;
    return React.cloneElement(original, {
      ...original.props,
      progressViewOffset: collapsedSheetHeight,
    });
  }, [scrollProps?.refreshControl, collapsedSheetHeight]);

  const scrollPropsDestructure = useMemo(() => {
    if (!isScrollMode) return null;
    const p = props as ScrollScreenScaffoldProps;
    return {
      contentContainerStyle: p.contentContainerStyle,
      style: p.style,
      children: p.children,
      useDesktopFrame: p.useDesktopFrame ?? true,
    };
  }, [isScrollMode, props]);

  useEffect(() => {
    setTopInsetTone(topInsetTone);
    return () => {
      setTopInsetTone("app");
    };
  }, [setTopInsetTone, topInsetTone]);

  if (!isScrollMode) {
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

  const {
    contentContainerStyle,
    style,
    children,
    useDesktopFrame = true,
  } = scrollPropsDestructure!;

  // Merge automatic insets with caller's contentContainerStyle
  // The caller's style may contain additional topSpacing/bottomSpacing/horizontalPadding
  // We need to ADD topSpacing/bottomSpacing to collapsedSheetHeight/safeBottom, not replace
  const flattenedCallerStyle = contentContainerStyle
    ? StyleSheet.flatten(contentContainerStyle)
    : {};
  const extraTopSpacing =
    typeof flattenedCallerStyle.paddingTop === "number" ? flattenedCallerStyle.paddingTop : 0;
  const extraBottomSpacing =
    typeof flattenedCallerStyle.paddingBottom === "number" ? flattenedCallerStyle.paddingBottom : 0;
  const combinedContentPadding = {
    paddingTop: collapsedSheetHeight + extraTopSpacing,
    paddingBottom: safeBottom + extraBottomSpacing,
    paddingHorizontal: flattenedCallerStyle.paddingHorizontal,
  };

  // For useDesktopFrame=true, pass combined padding to ScrollView directly
  // DesktopDashboardFrame contentStyle gets minimal styling for its internal layout
  const content = useDesktopFrame ? (
    <DesktopDashboardFrame contentStyle={{}}>{children}</DesktopDashboardFrame>
  ) : (
    children
  );

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
      {...scrollPropsWithRefresh}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={combinedContentPadding}
      refreshControl={refreshControlElement}
    >
      {content}
    </Animated.ScrollView>
  );
}
