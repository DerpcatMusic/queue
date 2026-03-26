import { View, type ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Radius, Spacing } from "@/theme/theme";

import type { BoxProps } from "./types";

function resolveSpace(token: keyof typeof Spacing | undefined) {
  return token ? Spacing[token] : undefined;
}

function omitUndefined(style: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(style).filter(([, value]) => value !== undefined),
  ) as ViewStyle;
}

export function Box({
  children,
  style,
  p: _p,
  px: _px,
  py: _py,
  pt: _pt,
  pr: _pr,
  pb: _pb,
  pl: _pl,
  m: _m,
  mx: _mx,
  my: _my,
  mt: _mt,
  mr: _mr,
  mb: _mb,
  ml: _ml,
  gap: _gap,
  backgroundColor: _backgroundColor,
  borderColor: _borderColor,
  borderRadius: _borderRadius,
  borderWidth: _borderWidth,
  ...viewProps
}: BoxProps) {
  const { color } = useTheme();
  const styleProps = omitUndefined({
    padding: resolveSpace(_p),
    paddingHorizontal: resolveSpace(_px),
    paddingVertical: resolveSpace(_py),
    paddingTop: resolveSpace(_pt),
    paddingRight: resolveSpace(_pr),
    paddingBottom: resolveSpace(_pb),
    paddingLeft: resolveSpace(_pl),
    margin: resolveSpace(_m),
    marginHorizontal: resolveSpace(_mx),
    marginVertical: resolveSpace(_my),
    marginTop: resolveSpace(_mt),
    marginRight: resolveSpace(_mr),
    marginBottom: resolveSpace(_mb),
    marginLeft: resolveSpace(_ml),
    gap: resolveSpace(_gap),
    display: viewProps.display,
    flexDirection: viewProps.flexDirection,
    alignItems: viewProps.alignItems,
    justifyContent: viewProps.justifyContent,
    flexWrap: viewProps.flexWrap,
    flex: viewProps.flex,
    flexGrow: viewProps.flexGrow,
    flexShrink: viewProps.flexShrink,
    alignSelf: viewProps.alignSelf,
    position: viewProps.position,
    top: viewProps.top,
    right: viewProps.right,
    bottom: viewProps.bottom,
    left: viewProps.left,
    zIndex: viewProps.zIndex,
    overflow: viewProps.overflow,
    opacity: viewProps.opacity,
    width: viewProps.width,
    height: viewProps.height,
    minWidth: viewProps.minWidth,
    minHeight: viewProps.minHeight,
    maxWidth: viewProps.maxWidth,
    backgroundColor: _backgroundColor ? color[_backgroundColor] : undefined,
    borderColor: _borderColor ? color[_borderColor] : undefined,
    borderRadius: _borderRadius ?? Radius.medium,
    borderWidth: _borderWidth,
  });

  return (
    <View {...viewProps} style={[styleProps, style]}>
      {children}
    </View>
  );
}
