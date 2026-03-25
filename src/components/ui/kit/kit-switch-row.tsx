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
        <ThemedText type="caption" style={{ color: foreground.muted }}>
          {description}
        </ThemedText>
      ) : null}
    </KitListItem>
  );
}
