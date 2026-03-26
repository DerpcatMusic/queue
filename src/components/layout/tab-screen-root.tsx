import type { PropsWithChildren, ReactElement } from "react";
import type { RefreshControlProps, ScrollViewProps, StyleProp, ViewStyle } from "react-native";

import type { InsetTone } from "@/contexts/system-ui-context";
import { ScreenScaffold } from "./screen-scaffold";

type BaseProps = {
  style?: StyleProp<ViewStyle>;
  topInsetTone?: InsetTone;
};

type TabScreenRootScrollProps = BaseProps & {
  mode: "scroll";
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle" | "refreshControl"> & {
    refreshControl?: ReactElement<RefreshControlProps>;
  };
  contentContainerStyle?: StyleProp<ViewStyle>;
  useDesktopFrame?: boolean;
};

type TabScreenRootStaticProps = BaseProps & {
  mode: "static";
};

export type TabScreenRootProps = PropsWithChildren<
  TabScreenRootScrollProps | TabScreenRootStaticProps
>;

export function TabScreenRoot(props: TabScreenRootProps) {
  if (props.mode === "static") {
    return (
      <ScreenScaffold
        mode="static"
        style={props.style}
        {...(props.topInsetTone ? { topInsetTone: props.topInsetTone } : {})}
      >
        {props.children}
      </ScreenScaffold>
    );
  }

  const { contentContainerStyle, scrollProps, style, children, topInsetTone, useDesktopFrame } =
    props;

  return (
    <ScreenScaffold
      mode="scroll"
      style={style}
      {...(topInsetTone ? { topInsetTone } : {})}
      {...(contentContainerStyle ? { contentContainerStyle } : {})}
      {...(scrollProps ? { scrollProps } : {})}
      {...(useDesktopFrame !== undefined ? { useDesktopFrame } : {})}
    >
      {children}
    </ScreenScaffold>
  );
}
