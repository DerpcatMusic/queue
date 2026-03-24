import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BrandRadius } from "@/constants/brand";
import { triggerSelectionHaptic } from "./native-interaction";
import { useKitTheme } from "./use-kit-theme";

type KitSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * iOS Human Interface Guidelines switch dimensions.
 * These are intentional design constants, not arbitrary values.
 * Track: 52x32pt with 26pt thumb provides optimal thumb travel distance.
 * TRACK_PADDING = (TRACK_HEIGHT - THUMB_SIZE) / 2 = (32 - 26) / 2 = 3pt
 */
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const TRACK_PADDING = 3;
const THUMB_SIZE = 26;
const THUMB_DISTANCE = TRACK_WIDTH - TRACK_PADDING * 2 - THUMB_SIZE;

export function KitSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: KitSwitchProps) {
  const { interaction } = useKitTheme();
  const progress = useSharedValue(value ? 1 : 0);
  const pressedTrackColor = value
    ? (interaction.switchTrackOn as string)
    : (interaction.switchTrackOff as string);
  const disabledTrackColor = value
    ? (interaction.switchTrackOn as string)
    : (interaction.switchTrackOff as string);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: value ? interaction.switchTrackOn : interaction.switchTrackOff,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_DISTANCE }],
    backgroundColor: value ? interaction.switchThumbOn : interaction.switchThumbOff,
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        triggerSelectionHaptic();
        onValueChange(!value);
      }}
      style={({ pressed }) => [
        styles.pressable,
        {
          borderRadius: BrandRadius.button,
          backgroundColor: disabled ? disabledTrackColor : pressed ? pressedTrackColor : undefined,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            borderRadius: BrandRadius.button,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: "center",
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    padding: TRACK_PADDING,
    justifyContent: "center",
  },
  thumb: {
    position: "absolute",
    top: TRACK_PADDING,
    left: TRACK_PADDING,
  },
});
