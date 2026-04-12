import { useCallback } from "react";
import { View } from "react-native";

import { Host, Toggle } from "@expo/ui/swift-ui";

import { useKitTheme } from "./use-kit-theme";

type KitSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * iOS native Switch using @expo/ui SwiftUI Toggle.
 * Wrapped in Host for SwiftUI rendering.
 */
export function KitSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: KitSwitchProps) {
  const { interaction } = useKitTheme();

  const handleChange = useCallback(
    (isOn: boolean) => {
      onValueChange(isOn);
    },
    [onValueChange],
  );

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}>
      <Host>
        <Toggle isOn={value} onIsOnChange={handleChange} disabled={disabled} />
      </Host>
    </View>
  );
}
