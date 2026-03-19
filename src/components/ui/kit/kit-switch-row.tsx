import { ThemedText } from "@/components/themed-text";
import { KitListItem } from "./kit-list";
import { KitSwitch } from "./kit-switch";
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
  const { foreground } = useKitTheme();

  return (
    <KitListItem
      title={title}
      accessory={<KitSwitch value={value} disabled={disabled} onValueChange={onValueChange} />}
    >
      {description ? (
        <ThemedText style={{ color: foreground.muted, fontSize: 13 }}>{description}</ThemedText>
      ) : null}
    </KitListItem>
  );
}
