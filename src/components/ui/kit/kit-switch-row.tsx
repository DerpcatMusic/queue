import { Switch } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { KitListItem } from "./kit-list";
import { triggerSelectionHaptic } from "./native-interaction";
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
  const { interaction, foreground } = useKitTheme();
  const handleValueChange = (nextValue: boolean) => {
    triggerSelectionHaptic();
    onValueChange(nextValue);
  };

  return (
    <KitListItem
      title={title}
      accessory={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={handleValueChange}
          trackColor={{
            false: interaction.switchTrackOff,
            true: interaction.switchTrackOn,
          }}
          thumbColor={
            value
              ? (interaction.switchThumbOn as string)
              : (interaction.switchThumbOff as string)
          }
          ios_backgroundColor={interaction.switchTrackOff as string}
        />
      }
    >
      {description ? (
        <ThemedText style={{ color: foreground.muted, fontSize: 13 }}>{description}</ThemedText>
      ) : null}
    </KitListItem>
  );
}
