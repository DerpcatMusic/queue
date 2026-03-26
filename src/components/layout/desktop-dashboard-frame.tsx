import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { BrandSpacing } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { Box } from "@/primitives";

const DESKTOP_FRAME_MAX_WIDTH = 1480;

export function useDesktopDashboardFrame() {
  const { isWideFrame: isWideWeb, screenWidth: width } = useLayoutBreakpoint();
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
    return <Box style={contentStyle}>{children}</Box>;
  }

  return (
    <Box
      style={{
        width: "100%",
        paddingHorizontal: frame.outerPadding,
      }}
    >
      <Box
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
      </Box>
    </Box>
  );
}
