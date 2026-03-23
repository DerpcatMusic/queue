import { Image as RNImage } from "expo-image";
import type React from "react";
import { StyleSheet } from "react-native";
import { useCssElement } from "react-native-css";
import Animated from "react-native-reanimated";

const AnimatedExpoImage = Animated.createAnimatedComponent(RNImage);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CSSImage(props: any) {
  const { objectFit, objectPosition, ...style } = StyleSheet.flatten(props.style) || {};
  const normalizedSource = typeof props.source === "string" ? { uri: props.source } : props.source;
  const derivedRecyclingKey =
    props.recyclingKey ??
    (normalizedSource &&
    typeof normalizedSource === "object" &&
    !Array.isArray(normalizedSource) &&
    "uri" in normalizedSource
      ? normalizedSource.uri
      : undefined);
  return (
    <AnimatedExpoImage
      contentFit={objectFit}
      contentPosition={objectPosition}
      {...props}
      source={normalizedSource}
      recyclingKey={derivedRecyclingKey}
      style={style}
    />
  );
}

export const Image = (props: React.ComponentProps<typeof CSSImage> & { className?: string }) => {
  return useCssElement(CSSImage, props, { className: "style" });
};
Image.displayName = "CSS(Image)";
