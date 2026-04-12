import { useCallback } from "react";
import { Platform, Switch } from "react-native";

import { Switch as AndroidSwitch, Host as AndroidHost } from "@expo/ui/jetpack-compose";
import { useTheme } from "@/hooks/use-theme";

export type NativeSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Native switch using platform-native components:
 * - iOS: React Native Switch
 * - Android: @expo/ui Jetpack Compose Switch (Material You with matchContents)
 */
export function NativeSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: NativeSwitchProps) {
  const theme = useTheme();

  const handleChange = useCallback(
    (newValue: boolean) => {
      if (!disabled) {
        onValueChange(newValue);
      }
    },
    [onValueChange, disabled],
  );

  if (Platform.OS === "ios") {
    return (
      <Switch
        value={value}
        onValueChange={handleChange}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      />
    );
  }

  // Android: @expo/ui Jetpack Compose Switch per official docs
  // Material You colors - ensure thumb is visible in both ON and OFF states
  const isDark = theme.scheme === "dark";
  return (
    <AndroidHost matchContents>
      <AndroidSwitch
        value={value}
        onCheckedChange={handleChange}
        enabled={!disabled}
        colors={{
          // ON: primary thumb with muted track
          checkedThumbColor: isDark ? theme.color.onPrimary : theme.color.primary,
          checkedTrackColor: isDark ? theme.color.primary : theme.color.primarySubtle,
          // OFF: darker thumb so it's visible against light track
          uncheckedThumbColor: isDark ? "#BDBDBD" : "#616161",
          uncheckedTrackColor: isDark ? "#424242" : "#E0E0E0",
          uncheckedBorderColor: isDark ? "#616161" : "#9E9E9E",
        }}
      />
    </AndroidHost>
  );
}
