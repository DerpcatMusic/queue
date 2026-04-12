import { useCallback } from "react";

import { Switch } from "@expo/ui/jetpack-compose";

import { useKitTheme } from "./use-kit-theme";

type KitSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Android native Switch using @expo/ui Jetpack Compose Switch.
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
    (checked: boolean) => {
      onValueChange(checked);
    },
    [onValueChange],
  );

  return (
    <Switch
      value={value}
      onCheckedChange={handleChange}
      enabled={!disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      colors={{
        checkedThumbColor: interaction.switchThumbOn,
        checkedTrackColor: interaction.switchTrackOn,
        uncheckedThumbColor: interaction.switchThumbOff,
        uncheckedTrackColor: interaction.switchTrackOff,
      }}
    />
  );
}
