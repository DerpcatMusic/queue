import { memo } from "react";
import { View } from "react-native";
import { StyleSheet, type UnistylesVariants } from "react-native-unistyles";

import { Radius } from "@/theme/theme";

import type { SpaceToken } from "./types";

type StackVariants = UnistylesVariants<typeof styles>;
type StackAlign = "start" | "center" | "end" | "stretch" | "baseline";
type StackJustify = "start" | "center" | "end" | "between" | "around" | "evenly";

export type StackProps = React.ComponentProps<typeof View> & {
  gap?: SpaceToken;
  align?: StackAlign;
  justify?: StackJustify;
} & StackVariants;

const styles = StyleSheet.create((theme) => ({
  stack: {
    variants: {
      direction: {
        vertical: { flexDirection: "column" },
        horizontal: { flexDirection: "row" },
      },
      gap: Object.fromEntries(
        Object.entries(theme.spacing).map(([token, value]) => [token, { gap: value }]),
      ),
      align: {
        start: { alignItems: "flex-start" },
        center: { alignItems: "center" },
        end: { alignItems: "flex-end" },
        stretch: { alignItems: "stretch" },
        baseline: { alignItems: "baseline" },
      },
      justify: {
        start: { justifyContent: "flex-start" },
        center: { justifyContent: "center" },
        end: { justifyContent: "flex-end" },
        between: { justifyContent: "space-between" },
        around: { justifyContent: "space-around" },
        evenly: { justifyContent: "space-evenly" },
      },
    },
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.card,
  },
}));

function StackBase({
  direction = "vertical",
  gap,
  align,
  justify,
  style,
  children,
  ...rest
}: StackProps & { direction?: "vertical" | "horizontal" }) {
  styles.useVariants({
    direction,
    gap,
    align,
    justify,
  });

  return (
    <View {...rest} style={[styles.stack, style]}>
      {children}
    </View>
  );
}

export const Stack = memo(StackBase);

export const VStack = memo(function VStack(props: Omit<StackProps, "direction">) {
  return <Stack {...props} direction="vertical" />;
});

export const HStack = memo(function HStack(props: Omit<StackProps, "direction">) {
  return <Stack {...props} direction="horizontal" />;
});

export const Center = memo(function Center({ style, children, ...rest }: React.ComponentProps<typeof View>) {
  return (
    <View {...rest} style={[styles.center, style]}>
      {children}
    </View>
  );
});

export const Inline = memo(function Inline({ align = "center", ...props }: Omit<StackProps, "direction">) {
  return <HStack {...props} align={align} />;
});
