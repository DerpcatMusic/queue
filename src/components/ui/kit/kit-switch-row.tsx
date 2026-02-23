import { Switch } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { KitListItem } from "./kit-list";
import { useKitTheme } from "./use-kit-theme";

type KitSwitchRowProps = {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function KitSwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: KitSwitchRowProps) {
  const { palette, switchTrackOff, switchTrackOn } = useKitTheme();

  return (
    <KitListItem
      title={title}
      accessory={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          trackColor={{ false: switchTrackOff, true: switchTrackOn }}
          thumbColor={value ? (palette.primary as string) : (palette.surface as string)}
          ios_backgroundColor={switchTrackOff}
        />
      }
    >
      {description ? (
        <ThemedText style={{ color: palette.textMuted, fontSize: 13 }}>{description}</ThemedText>
      ) : null}
    </KitListItem>
  );
}

