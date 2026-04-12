import { memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Radius, Spacing } from "@/theme/theme";

import type { BoxProps } from "./types";

const styles = StyleSheet.create((theme) => ({
  // ─── Base ────────────────────────────────────────────────────────────────────
  base: {},

  // ─── Padding variants ─────────────────────────────────────────────────────────
  p_xxs: { padding: Spacing.xxs },
  p_xs: { padding: Spacing.xs },
  p_sm: { padding: Spacing.sm },
  p_md: { padding: Spacing.md },
  p_lg: { padding: Spacing.lg },
  p_xl: { padding: Spacing.xl },
  p_xxl: { padding: Spacing.xxl },
  p_component: { padding: Spacing.component },
  p_control: { padding: Spacing.control },
  p_inset: { padding: Spacing.inset },
  p_insetTight: { padding: Spacing.insetTight },
  p_insetSoft: { padding: Spacing.insetSoft },
  p_insetComfort: { padding: Spacing.insetComfort },
  p_insetRoomy: { padding: Spacing.insetRoomy },

  px_xxs: { paddingHorizontal: Spacing.xxs },
  px_xs: { paddingHorizontal: Spacing.xs },
  px_sm: { paddingHorizontal: Spacing.sm },
  px_md: { paddingHorizontal: Spacing.md },
  px_lg: { paddingHorizontal: Spacing.lg },
  px_xl: { paddingHorizontal: Spacing.xl },
  px_xxl: { paddingHorizontal: Spacing.xxl },
  px_component: { paddingHorizontal: Spacing.component },
  px_control: { paddingHorizontal: Spacing.control },
  px_inset: { paddingHorizontal: Spacing.inset },
  px_insetTight: { paddingHorizontal: Spacing.insetTight },
  px_insetSoft: { paddingHorizontal: Spacing.insetSoft },
  px_insetComfort: { paddingHorizontal: Spacing.insetComfort },
  px_insetRoomy: { paddingHorizontal: Spacing.insetRoomy },

  py_xxs: { paddingVertical: Spacing.xxs },
  py_xs: { paddingVertical: Spacing.xs },
  py_sm: { paddingVertical: Spacing.sm },
  py_md: { paddingVertical: Spacing.md },
  py_lg: { paddingVertical: Spacing.lg },
  py_xl: { paddingVertical: Spacing.xl },
  py_xxl: { paddingVertical: Spacing.xxl },
  py_component: { paddingVertical: Spacing.component },
  py_control: { paddingVertical: Spacing.control },
  py_inset: { paddingVertical: Spacing.inset },
  py_insetTight: { paddingVertical: Spacing.insetTight },
  py_insetSoft: { paddingVertical: Spacing.insetSoft },
  py_insetComfort: { paddingVertical: Spacing.insetComfort },
  py_insetRoomy: { paddingVertical: Spacing.insetRoomy },

  pt_xxs: { paddingTop: Spacing.xxs },
  pt_xs: { paddingTop: Spacing.xs },
  pt_sm: { paddingTop: Spacing.sm },
  pt_md: { paddingTop: Spacing.md },
  pt_lg: { paddingTop: Spacing.lg },
  pt_xl: { paddingTop: Spacing.xl },
  pt_xxl: { paddingTop: Spacing.xxl },
  pt_inset: { paddingTop: Spacing.inset },
  pt_insetSoft: { paddingTop: Spacing.insetSoft },

  pb_xxs: { paddingBottom: Spacing.xxs },
  pb_xs: { paddingBottom: Spacing.xs },
  pb_sm: { paddingBottom: Spacing.sm },
  pb_md: { paddingBottom: Spacing.md },
  pb_lg: { paddingBottom: Spacing.lg },
  pb_xl: { paddingBottom: Spacing.xl },
  pb_xxl: { paddingBottom: Spacing.xxl },
  pb_inset: { paddingBottom: Spacing.inset },
  pb_insetSoft: { paddingBottom: Spacing.insetSoft },

  pl_xxs: { paddingLeft: Spacing.xxs },
  pl_xs: { paddingLeft: Spacing.xs },
  pl_sm: { paddingLeft: Spacing.sm },
  pl_md: { paddingLeft: Spacing.md },
  pl_lg: { paddingLeft: Spacing.lg },
  pl_xl: { paddingLeft: Spacing.xl },
  pl_xxl: { paddingLeft: Spacing.xxl },
  pl_inset: { paddingLeft: Spacing.inset },
  pl_insetSoft: { paddingLeft: Spacing.insetSoft },

  pr_xxs: { paddingRight: Spacing.xxs },
  pr_xs: { paddingRight: Spacing.xs },
  pr_sm: { paddingRight: Spacing.sm },
  pr_md: { paddingRight: Spacing.md },
  pr_lg: { paddingRight: Spacing.lg },
  pr_xl: { paddingRight: Spacing.xl },
  pr_xxl: { paddingRight: Spacing.xxl },
  pr_inset: { paddingRight: Spacing.inset },
  pr_insetSoft: { paddingRight: Spacing.insetSoft },

  // ─── Margin variants ─────────────────────────────────────────────────────────
  m_xxs: { margin: Spacing.xxs },
  m_xs: { margin: Spacing.xs },
  m_sm: { margin: Spacing.sm },
  m_md: { margin: Spacing.md },
  m_lg: { margin: Spacing.lg },
  m_xl: { margin: Spacing.xl },
  m_xxl: { margin: Spacing.xxl },
  m_inset: { margin: Spacing.inset },
  m_insetRoomy: { margin: Spacing.insetRoomy },

  mx_xxs: { marginHorizontal: Spacing.xxs },
  mx_xs: { marginHorizontal: Spacing.xs },
  mx_sm: { marginHorizontal: Spacing.sm },
  mx_md: { marginHorizontal: Spacing.md },
  mx_lg: { marginHorizontal: Spacing.lg },
  mx_xl: { marginHorizontal: Spacing.xl },
  mx_xxl: { marginHorizontal: Spacing.xxl },
  mx_inset: { marginHorizontal: Spacing.inset },
  mx_insetRoomy: { marginHorizontal: Spacing.insetRoomy },

  my_xxs: { marginVertical: Spacing.xxs },
  my_xs: { marginVertical: Spacing.xs },
  my_sm: { marginVertical: Spacing.sm },
  my_md: { marginVertical: Spacing.md },
  my_lg: { marginVertical: Spacing.lg },
  my_xl: { marginVertical: Spacing.xl },
  my_xxl: { marginVertical: Spacing.xxl },
  my_inset: { marginVertical: Spacing.inset },
  my_insetRoomy: { marginVertical: Spacing.insetRoomy },

  mt_xxs: { marginTop: Spacing.xxs },
  mt_xs: { marginTop: Spacing.xs },
  mt_sm: { marginTop: Spacing.sm },
  mt_md: { marginTop: Spacing.md },
  mt_lg: { marginTop: Spacing.lg },
  mt_xl: { marginTop: Spacing.xl },
  mt_xxl: { marginTop: Spacing.xxl },
  mt_inset: { marginTop: Spacing.inset },
  mt_insetRoomy: { marginTop: Spacing.insetRoomy },

  mb_xxs: { marginBottom: Spacing.xxs },
  mb_xs: { marginBottom: Spacing.xs },
  mb_sm: { marginBottom: Spacing.sm },
  mb_md: { marginBottom: Spacing.md },
  mb_lg: { marginBottom: Spacing.lg },
  mb_xl: { marginBottom: Spacing.xl },
  mb_xxl: { marginBottom: Spacing.xxl },
  mb_inset: { marginBottom: Spacing.inset },
  mb_insetRoomy: { marginBottom: Spacing.insetRoomy },

  ml_xxs: { marginLeft: Spacing.xxs },
  ml_xs: { marginLeft: Spacing.xs },
  ml_sm: { marginLeft: Spacing.sm },
  ml_md: { marginLeft: Spacing.md },
  ml_lg: { marginLeft: Spacing.lg },
  ml_xl: { marginLeft: Spacing.xl },
  ml_xxl: { marginLeft: Spacing.xxl },
  ml_inset: { marginLeft: Spacing.inset },
  ml_insetRoomy: { marginLeft: Spacing.insetRoomy },

  mr_xxs: { marginRight: Spacing.xxs },
  mr_xs: { marginRight: Spacing.xs },
  mr_sm: { marginRight: Spacing.sm },
  mr_md: { marginRight: Spacing.md },
  mr_lg: { marginRight: Spacing.lg },
  mr_xl: { marginRight: Spacing.xl },
  mr_xxl: { marginRight: Spacing.xxl },
  mr_inset: { marginRight: Spacing.inset },
  mr_insetRoomy: { marginRight: Spacing.insetRoomy },

  // ─── Gap variants ────────────────────────────────────────────────────────────
  gap_xxs: { gap: Spacing.xxs },
  gap_xs: { gap: Spacing.xs },
  gap_sm: { gap: Spacing.sm },
  gap_md: { gap: Spacing.md },
  gap_lg: { gap: Spacing.lg },
  gap_xl: { gap: Spacing.xl },
  gap_xxl: { gap: Spacing.xxl },
  gap_inset: { gap: Spacing.inset },
  gap_insetRoomy: { gap: Spacing.insetRoomy },

  // ─── Background color variants ───────────────────────────────────────────────
  bg_primary: { backgroundColor: theme.color.primary },
  bg_primarySubtle: { backgroundColor: theme.color.primarySubtle },
  bg_secondary: { backgroundColor: theme.color.secondary },
  bg_secondarySubtle: { backgroundColor: theme.color.secondarySubtle },
  bg_success: { backgroundColor: theme.color.success },
  bg_successSubtle: { backgroundColor: theme.color.successSubtle },
  bg_danger: { backgroundColor: theme.color.danger },
  bg_dangerSubtle: { backgroundColor: theme.color.dangerSubtle },
  bg_warning: { backgroundColor: theme.color.warning },
  bg_warningSubtle: { backgroundColor: theme.color.warningSubtle },
  bg_surface: { backgroundColor: theme.color.surface },
  bg_surfaceMuted: { backgroundColor: theme.color.surfaceMuted },
  bg_surfaceElevated: { backgroundColor: theme.color.surfaceElevated },
  bg_appBg: { backgroundColor: theme.color.appBg },
  bg_tertiary: { backgroundColor: theme.color.tertiary },
  bg_tertiarySubtle: { backgroundColor: theme.color.tertiarySubtle },

  // ─── Border color variants ───────────────────────────────────────────────────
  border_primary: { borderColor: theme.color.primary },
  border_default: { borderColor: theme.color.border },
  border_strong: { borderColor: theme.color.borderStrong },
  border_divider: { borderColor: theme.color.divider },

  // ─── Layout variants ─────────────────────────────────────────────────────────
  display_flex: { display: "flex" as const },
  display_none: { display: "none" as const },
  flexDir_row: { flexDirection: "row" as const },
  flexDir_column: { flexDirection: "column" as const },
  flexDir_rowReverse: { flexDirection: "row-reverse" as const },
  flexDir_columnReverse: { flexDirection: "column-reverse" as const },
  alignItems_start: { alignItems: "flex-start" as const },
  alignItems_center: { alignItems: "center" as const },
  alignItems_end: { alignItems: "flex-end" as const },
  alignItems_stretch: { alignItems: "stretch" as const },
  alignItems_baseline: { alignItems: "baseline" as const },
  justifyContent_start: { justifyContent: "flex-start" as const },
  justifyContent_center: { justifyContent: "center" as const },
  justifyContent_end: { justifyContent: "flex-end" as const },
  justifyContent_between: { justifyContent: "space-between" as const },
  justifyContent_around: { justifyContent: "space-around" as const },
  justifyContent_evenly: { justifyContent: "space-evenly" as const },
  flexWrap_wrap: { flexWrap: "wrap" as const },
  flexWrap_nowrap: { flexWrap: "nowrap" as const },
  alignSelf_start: { alignSelf: "flex-start" as const },
  alignSelf_center: { alignSelf: "center" as const },
  alignSelf_end: { alignSelf: "flex-end" as const },
  alignSelf_stretch: { alignSelf: "stretch" as const },
  alignSelf_baseline: { alignSelf: "baseline" as const },
  position_absolute: { position: "absolute" as const },
  position_relative: { position: "relative" as const },
  overflow_visible: { overflow: "visible" as const },
  overflow_hidden: { overflow: "hidden" as const },
}));

// Lookup tables for variant keys
const spacingVariantMap: Record<string, string> = {
  p_xxs: "p_xxs",
  p_xs: "p_xs",
  p_sm: "p_sm",
  p_md: "p_md",
  p_lg: "p_lg",
  p_xl: "p_xl",
  p_xxl: "p_xxl",
  px_xxs: "px_xxs",
  px_xs: "px_xs",
  px_sm: "px_sm",
  px_md: "px_md",
  px_lg: "px_lg",
  px_xl: "px_xl",
  px_xxl: "px_xxl",
  py_xxs: "py_xxs",
  py_xs: "py_xs",
  py_sm: "py_sm",
  py_md: "py_md",
  py_lg: "py_lg",
  py_xl: "py_xl",
  py_xxl: "py_xxl",
  pt_xxs: "pt_xxs",
  pt_xs: "pt_xs",
  pt_sm: "pt_sm",
  pt_md: "pt_md",
  pt_lg: "pt_lg",
  pt_xl: "pt_xl",
  pt_xxl: "pt_xxl",
  pb_xxs: "pb_xxs",
  pb_xs: "pb_xs",
  pb_sm: "pb_sm",
  pb_md: "pb_md",
  pb_lg: "pb_lg",
  pb_xl: "pb_xl",
  pb_xxl: "pb_xxl",
  pl_xxs: "pl_xxs",
  pl_xs: "pl_xs",
  pl_sm: "pl_sm",
  pl_md: "pl_md",
  pl_lg: "pl_lg",
  pl_xl: "pl_xl",
  pl_xxl: "pl_xxl",
  pr_xxs: "pr_xxs",
  pr_xs: "pr_xs",
  pr_sm: "pr_sm",
  pr_md: "pr_md",
  pr_lg: "pr_lg",
  pr_xl: "pr_xl",
  pr_xxl: "pr_xxl",
  m_xxs: "m_xxs",
  m_xs: "m_xs",
  m_sm: "m_sm",
  m_md: "m_md",
  m_lg: "m_lg",
  m_xl: "m_xl",
  m_xxl: "m_xxl",
  mx_xxs: "mx_xxs",
  mx_xs: "mx_xs",
  mx_sm: "mx_sm",
  mx_md: "mx_md",
  mx_lg: "mx_lg",
  mx_xl: "mx_xl",
  mx_xxl: "mx_xxl",
  my_xxs: "my_xxs",
  my_xs: "my_xs",
  my_sm: "my_sm",
  my_md: "my_md",
  my_lg: "my_lg",
  my_xl: "my_xl",
  my_xxl: "my_xxl",
  mt_xxs: "mt_xxs",
  mt_xs: "mt_xs",
  mt_sm: "mt_sm",
  mt_md: "mt_md",
  mt_lg: "mt_lg",
  mt_xl: "mt_xl",
  mt_xxl: "mt_xxl",
  mb_xxs: "mb_xxs",
  mb_xs: "mb_xs",
  mb_sm: "mb_sm",
  mb_md: "mb_md",
  mb_lg: "mb_lg",
  mb_xl: "mb_xl",
  mb_xxl: "mb_xxl",
  ml_xxs: "ml_xxs",
  ml_xs: "ml_xs",
  ml_sm: "ml_sm",
  ml_md: "ml_md",
  ml_lg: "ml_lg",
  ml_xl: "ml_xl",
  ml_xxl: "ml_xxl",
  mr_xxs: "mr_xxs",
  mr_xs: "mr_xs",
  mr_sm: "mr_sm",
  mr_md: "mr_md",
  mr_lg: "mr_lg",
  mr_xl: "mr_xl",
  mr_xxl: "mr_xxl",
  gap_xxs: "gap_xxs",
  gap_xs: "gap_xs",
  gap_sm: "gap_sm",
  gap_md: "gap_md",
  gap_lg: "gap_lg",
  gap_xl: "gap_xl",
  gap_xxl: "gap_xxl",
  p_inset: "p_inset",
  p_insetTight: "p_insetTight",
  p_insetSoft: "p_insetSoft",
  p_insetComfort: "p_insetComfort",
  p_insetRoomy: "p_insetRoomy",
  px_inset: "px_inset",
  px_insetTight: "px_insetTight",
  px_insetSoft: "px_insetSoft",
  px_insetComfort: "px_insetComfort",
  px_insetRoomy: "px_insetRoomy",
  py_inset: "py_inset",
  py_insetTight: "py_insetTight",
  py_insetSoft: "py_insetSoft",
  py_insetComfort: "py_insetComfort",
  py_insetRoomy: "py_insetRoomy",
  pt_inset: "pt_inset",
  pt_insetSoft: "pt_insetSoft",
  pb_inset: "pb_inset",
  pb_insetSoft: "pb_insetSoft",
  pl_inset: "pl_inset",
  pl_insetSoft: "pl_insetSoft",
  pr_inset: "pr_inset",
  pr_insetSoft: "pr_insetSoft",
  m_inset: "m_inset",
  m_insetRoomy: "m_insetRoomy",
  mx_inset: "mx_inset",
  mx_insetRoomy: "mx_insetRoomy",
  my_inset: "my_inset",
  my_insetRoomy: "my_insetRoomy",
  mt_inset: "mt_inset",
  mt_insetRoomy: "mt_insetRoomy",
  mb_inset: "mb_inset",
  mb_insetRoomy: "mb_insetRoomy",
  ml_inset: "ml_inset",
  ml_insetRoomy: "ml_insetRoomy",
  mr_inset: "mr_inset",
  mr_insetRoomy: "mr_insetRoomy",
  gap_inset: "gap_inset",
  gap_insetRoomy: "gap_insetRoomy",
  p_component: "p_component",
  p_control: "p_control",
  px_component: "px_component",
  px_control: "px_control",
  py_component: "py_component",
  py_control: "py_control",
};

const bgVariantMap: Record<string, string> = {
  primary: "bg_primary",
  primarySubtle: "bg_primarySubtle",
  secondary: "bg_secondary",
  secondarySubtle: "bg_secondarySubtle",
  success: "bg_success",
  successSubtle: "bg_successSubtle",
  danger: "bg_danger",
  dangerSubtle: "bg_dangerSubtle",
  warning: "bg_warning",
  warningSubtle: "bg_warningSubtle",
  surface: "bg_surface",
  surfaceMuted: "bg_surfaceMuted",
  surfaceElevated: "bg_surfaceElevated",
  appBg: "bg_appBg",
  tertiary: "bg_tertiary",
  tertiarySubtle: "bg_tertiarySubtle",
};

const borderVariantMap: Record<string, string> = {
  primary: "border_primary",
  border: "border_default",
  borderStrong: "border_strong",
  divider: "border_divider",
};

const flexDirVariantMap: Record<string, string> = {
  row: "flexDir_row",
  column: "flexDir_column",
  rowReverse: "flexDir_rowReverse",
  columnReverse: "flexDir_columnReverse",
};

const alignItemsVariantMap: Record<string, string> = {
  start: "alignItems_start",
  center: "alignItems_center",
  end: "alignItems_end",
  stretch: "alignItems_stretch",
  baseline: "alignItems_baseline",
};

const justifyContentVariantMap: Record<string, string> = {
  start: "justifyContent_start",
  center: "justifyContent_center",
  end: "justifyContent_end",
  between: "justifyContent_between",
  around: "justifyContent_around",
  evenly: "justifyContent_evenly",
};

const alignSelfVariantMap: Record<string, string> = {
  start: "alignSelf_start",
  center: "alignSelf_center",
  end: "alignSelf_end",
  stretch: "alignSelf_stretch",
  baseline: "alignSelf_baseline",
};

const displayVariantMap: Record<string, string> = {
  flex: "display_flex",
  none: "display_none",
};

const flexWrapVariantMap: Record<string, string> = {
  wrap: "flexWrap_wrap",
  nowrap: "flexWrap_nowrap",
};

const positionVariantMap: Record<string, string> = {
  absolute: "position_absolute",
  relative: "position_relative",
};

const overflowVariantMap: Record<string, string> = {
  visible: "overflow_visible",
  hidden: "overflow_hidden",
};

// Helper to get variant style or undefined
function getVariantStyle(variantKey: string | undefined): ViewStyle | undefined {
  if (!variantKey) return undefined;
  const stylesheetKey = spacingVariantMap[variantKey] ?? variantKey;
  return (styles as Record<string, ViewStyle>)[stylesheetKey];
}

function getBgVariantStyle(token: string | undefined): ViewStyle | undefined {
  if (!token) return undefined;
  const key = bgVariantMap[token];
  return key ? (styles as Record<string, ViewStyle>)[key] : undefined;
}

function getBorderVariantStyle(token: string | undefined): ViewStyle | undefined {
  if (!token) return undefined;
  const key = borderVariantMap[token];
  return key ? (styles as Record<string, ViewStyle>)[key] : undefined;
}

export const Box = memo(function Box({
  children,
  style,
  p,
  px,
  py,
  pt,
  pr,
  pb,
  pl,
  m,
  mx,
  my,
  mt,
  mr,
  mb,
  ml,
  gap,
  backgroundColor,
  borderColor,
  borderRadius,
  borderWidth,
  display,
  flexDirection,
  alignItems,
  justifyContent,
  flexWrap,
  flex,
  flexGrow,
  flexShrink,
  alignSelf,
  position,
  top,
  right,
  bottom,
  left,
  zIndex,
  overflow,
  opacity,
  width,
  height,
  minWidth,
  minHeight,
  maxWidth,
  ...viewProps
}: BoxProps) {
  // Collect variant styles (Unistyles-compiled to native)
  const variantStyles: ViewStyle[] = [];

  // Padding variants
  if (p) {
    const s = getVariantStyle(`p_${p}`);
    if (s) variantStyles.push(s);
  }
  if (px) {
    const s = getVariantStyle(`px_${px}`);
    if (s) variantStyles.push(s);
  }
  if (py) {
    const s = getVariantStyle(`py_${py}`);
    if (s) variantStyles.push(s);
  }
  if (pt) {
    const s = getVariantStyle(`pt_${pt}`);
    if (s) variantStyles.push(s);
  }
  if (pr) {
    const s = getVariantStyle(`pr_${pr}`);
    if (s) variantStyles.push(s);
  }
  if (pb) {
    const s = getVariantStyle(`pb_${pb}`);
    if (s) variantStyles.push(s);
  }
  if (pl) {
    const s = getVariantStyle(`pl_${pl}`);
    if (s) variantStyles.push(s);
  }

  // Margin variants
  if (m) {
    const s = getVariantStyle(`m_${m}`);
    if (s) variantStyles.push(s);
  }
  if (mx) {
    const s = getVariantStyle(`mx_${mx}`);
    if (s) variantStyles.push(s);
  }
  if (my) {
    const s = getVariantStyle(`my_${my}`);
    if (s) variantStyles.push(s);
  }
  if (mt) {
    const s = getVariantStyle(`mt_${mt}`);
    if (s) variantStyles.push(s);
  }
  if (mr) {
    const s = getVariantStyle(`mr_${mr}`);
    if (s) variantStyles.push(s);
  }
  if (mb) {
    const s = getVariantStyle(`mb_${mb}`);
    if (s) variantStyles.push(s);
  }
  if (ml) {
    const s = getVariantStyle(`ml_${ml}`);
    if (s) variantStyles.push(s);
  }

  // Gap variant
  if (gap) {
    const s = getVariantStyle(`gap_${gap}`);
    if (s) variantStyles.push(s);
  }

  // Background color variant
  const bgStyle = getBgVariantStyle(backgroundColor);
  if (bgStyle) variantStyles.push(bgStyle);

  // Border color variant
  const borderStyle = getBorderVariantStyle(borderColor);
  if (borderStyle) variantStyles.push(borderStyle);

  // Layout variants
  if (display) {
    const s = (styles as Record<string, ViewStyle>)[displayVariantMap[display] ?? display];
    if (s) variantStyles.push(s);
  }
  if (flexDirection) {
    const s = (styles as Record<string, ViewStyle>)[
      flexDirVariantMap[flexDirection] ?? flexDirection
    ];
    if (s) variantStyles.push(s);
  }
  if (alignItems) {
    const s = (styles as Record<string, ViewStyle>)[alignItemsVariantMap[alignItems] ?? alignItems];
    if (s) variantStyles.push(s);
  }
  if (justifyContent) {
    const s = (styles as Record<string, ViewStyle>)[
      justifyContentVariantMap[justifyContent] ?? justifyContent
    ];
    if (s) variantStyles.push(s);
  }
  if (flexWrap) {
    const s = (styles as Record<string, ViewStyle>)[flexWrapVariantMap[flexWrap] ?? flexWrap];
    if (s) variantStyles.push(s);
  }
  if (alignSelf) {
    const s = (styles as Record<string, ViewStyle>)[alignSelfVariantMap[alignSelf] ?? alignSelf];
    if (s) variantStyles.push(s);
  }
  if (position) {
    const s = (styles as Record<string, ViewStyle>)[positionVariantMap[position] ?? position];
    if (s) variantStyles.push(s);
  }
  if (overflow) {
    const s = (styles as Record<string, ViewStyle>)[overflowVariantMap[overflow] ?? overflow];
    if (s) variantStyles.push(s);
  }

  // Build raw style for values that can't be variant-ized
  const rawStyle: ViewStyle = {
    flex,
    flexGrow,
    flexShrink,
    top,
    right,
    bottom,
    left,
    zIndex,
    opacity,
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    borderRadius: borderRadius ?? Radius.medium,
    borderWidth,
  };

  return (
    <View
      {...viewProps}
      style={[styles.base, ...variantStyles, rawStyle, style] as StyleProp<ViewStyle>}
    >
      {children}
    </View>
  );
});
