import type { PropsWithChildren } from "react";
import { type StyleProp, useWindowDimensions, View, type ViewStyle } from "react-native";

import { BrandSpacing } from "@/constants/brand";

const DESKTOP_FRAME_BREAKPOINT = 1100;
const DESKTOP_FRAME_MAX_WIDTH = 1480;

export function useDesktopDashboardFrame() {
  const { width } = useWindowDimensions();
  const isWideWeb = process.env.EXPO_OS === "web" && width >= DESKTOP_FRAME_BREAKPOINT;
  const outerPadding = isWideWeb ? Math.max(BrandSpacing.xl, Math.min(48, width * 0.035)) : 0;

  return {
    isWideWeb,
    outerPadding,
    contentMaxWidth: DESKTOP_FRAME_MAX_WIDTH,
  };
}

type DesktopDashboardFrameProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function DesktopDashboardFrame({ children, contentStyle }: DesktopDashboardFrameProps) {
  const frame = useDesktopDashboardFrame();

  if (!frame.isWideWeb) {
    return <View style={contentStyle}>{children}</View>;
  }

  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: frame.outerPadding,
      }}
    >
      <View
        style={[
          {
            width: "100%",
            maxWidth: frame.contentMaxWidth,
            alignSelf: "center",
            minHeight: "100%",
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
