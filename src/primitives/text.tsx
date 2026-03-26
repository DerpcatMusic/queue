import { memo } from "react";
import { Text as RNText } from "react-native";

import { useTheme } from "@/hooks/use-theme";

import type { TextProps } from "./types";

export const Text = memo(function Text({ variant = "body", color, style, children, ...rest }: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: color ? theme.color[color] : theme.color.text, includeFontPadding: false },
        style,
      ]}
    >
      {children}
    </RNText>
  );
});
