import { useAppInsets } from "@/hooks/use-app-insets";
import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type TabOverlayAnchorProps = PropsWithChildren<{
  side?: "left" | "right";
  offset?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function TabOverlayAnchor({
  children,
  side = "right",
  offset = 16,
  style,
}: TabOverlayAnchorProps) {
  const { overlayBottom } = useAppInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          bottom: overlayBottom,
          ...(side === "left" ? { left: offset } : { right: offset }),
          zIndex: 30,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
