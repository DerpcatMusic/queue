import { memo } from "react";
import { View } from "react-native";

import { Spacing } from "@/theme/theme";

import type { SpaceToken } from "./types";

export type SpacerProps = {
  size?: SpaceToken;
  axis?: "vertical" | "horizontal";
};

export const Spacer = memo(function Spacer({ size = "md", axis = "vertical" }: SpacerProps) {
  const value = Spacing[size];

  return <View pointerEvents="none" style={axis === "horizontal" ? { width: value } : { height: value }} />;
});
