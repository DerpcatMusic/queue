import type {
  ColorValue,
  DimensionValue,
  StyleProp,
  TextProps as RNTextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from "react-native";
import type {
  ColorToken,
  IconSizeToken,
  SpaceToken,
  TypographyToken,
} from "@/theme/theme";

// Re-export theme tokens for primitive consumers
export type { ColorToken, IconSizeToken, SpaceToken, TypographyToken };

// ─── Spacing token props ───────────────────────────────────────────────────────

export type SpacingShorthand =
  | "p"
  | "px"
  | "py"
  | "pt"
  | "pr"
  | "pb"
  | "pl"
  | "m"
  | "mx"
  | "my"
  | "mt"
  | "mr"
  | "mb"
  | "ml"
  | "gap";

export type SpacingProps = {
  [K in SpacingShorthand]?: SpaceToken;
};

// ─── Safe layout props ─────────────────────────────────────────────────────────

export type SafeLayoutProps = Pick<
  ViewStyle,
  | "display"
  | "flexDirection"
  | "alignItems"
  | "justifyContent"
  | "flexWrap"
  | "flex"
  | "flexGrow"
  | "flexShrink"
  | "alignSelf"
  | "position"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "zIndex"
  | "overflow"
  | "opacity"
  | "width"
  | "height"
  | "minHeight"
  | "maxWidth"
>;

// ─── Primitive component props ──────────────────────────────────────────────────

export type BoxProps = ViewProps &
  SpacingProps &
  SafeLayoutProps & {
    style?: StyleProp<ViewStyle>;
    backgroundColor?: ColorToken;
    borderColor?: ColorToken;
    borderRadius?: DimensionValue;
    borderWidth?: number;
  };

export type StackDirection = "vertical" | "horizontal";

export type TextProps = RNTextProps & {
  variant?: TypographyToken;
  color?: ColorToken;
  style?: StyleProp<TextStyle>;
};

export type IconProps = {
  name: React.ComponentProps<typeof import("@/components/ui/app-symbol").AppSymbol>["name"];
  size?: IconSizeToken | number;
  color?: ColorToken;
  tintColor?: string | ColorValue;
  style?: StyleProp<TextStyle>;
};
