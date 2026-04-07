import { memo } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Radius, Spacing } from "@/theme/theme";

type StackAlign = "start" | "center" | "end" | "stretch" | "baseline";
type StackJustify = "start" | "center" | "end" | "between" | "around" | "evenly";
type StackGap =
  | "xxs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "xxl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "stackHair";

const gapValues: Record<StackGap, number> = {
  xxs: Spacing.xxs,
  xs: Spacing.xs,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.lg,
  xl: Spacing.xl,
  xxl: Spacing.xxl,
  "2xl": 38,
  "3xl": 44,
  "4xl": 56,
  stackHair: Spacing.stackHair,
};

export type StackProps = React.ComponentProps<typeof View> & {
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  direction?: "vertical" | "horizontal";
};

const styles = StyleSheet.create({
  vertical: {
    flexDirection: "column",
  },
  horizontal: {
    flexDirection: "row",
  },
  alignStart: {
    alignItems: "flex-start",
  },
  alignCenter: {
    alignItems: "center",
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  alignStretch: {
    alignItems: "stretch",
  },
  alignBaseline: {
    alignItems: "baseline",
  },
  justifyStart: {
    justifyContent: "flex-start",
  },
  justifyCenter: {
    justifyContent: "center",
  },
  justifyEnd: {
    justifyContent: "flex-end",
  },
  justifyBetween: {
    justifyContent: "space-between",
  },
  justifyAround: {
    justifyContent: "space-around",
  },
  justifyEvenly: {
    justifyContent: "space-evenly",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.card,
  },
});

const alignMap = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
  stretch: styles.alignStretch,
  baseline: styles.alignBaseline,
} as const;

const justifyMap = {
  start: styles.justifyStart,
  center: styles.justifyCenter,
  end: styles.justifyEnd,
  between: styles.justifyBetween,
  around: styles.justifyAround,
  evenly: styles.justifyEvenly,
} as const;

function StackBase({
  direction = "vertical",
  gap,
  align,
  justify,
  style,
  children,
  ...rest
}: StackProps) {
  const directionStyle = direction === "vertical" ? styles.vertical : styles.horizontal;
  const gapStyle = gap != null ? { gap: gapValues[gap] } : undefined;
  const alignStyle = align ? alignMap[align] : undefined;
  const justifyStyle = justify ? justifyMap[justify] : undefined;

  return (
    <View {...rest} style={[directionStyle, gapStyle, alignStyle, justifyStyle, style]}>
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

export const Center = memo(function Center({
  style,
  children,
  ...rest
}: React.ComponentProps<typeof View>) {
  return (
    <View {...rest} style={[styles.center, style]}>
      {children}
    </View>
  );
});

export const Inline = memo(function Inline({
  align = "center",
  ...props
}: Omit<StackProps, "direction">) {
  return <HStack {...props} align={align} />;
});
