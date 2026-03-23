import { useCssElement } from "react-native-css";
import React from "react";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Image as RNImage } from "expo-image";

const AnimatedExpoImage = Animated.createAnimatedComponent(RNImage);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CSSImage(props: any) {
  const { objectFit, objectPosition, ...style } = StyleSheet.flatten(props.style) || {};
  return <AnimatedExpoImage contentFit={objectFit} contentPosition={objectPosition} {...props} source={typeof props.source === "string" ? { uri: props.source } : props.source} style={style} />;
}

export const Image = (props: React.ComponentProps<typeof CSSImage> & { className?: string }) => {
  return useCssElement(CSSImage, props, { className: "style" });
};
Image.displayName = "CSS(Image)";
