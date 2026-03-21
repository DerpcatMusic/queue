import { KitSurface, KitTextField } from "@/components/ui/kit";
import type { EditableExtraField } from "./types";

type ProfileEditorBasicsPanelProps = {
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  bioDraft: string;
  onBioDraftChange: (value: string) => void;
  extraField?: EditableExtraField | undefined;
  isDesktopWeb: boolean;
};

export function ProfileEditorBasicsPanel({
  nameDraft,
  onNameDraftChange,
  bioDraft,
  onBioDraftChange,
  extraField,
  isDesktopWeb,
}: ProfileEditorBasicsPanelProps) {
  return (
    <KitSurface
      tone="base"
      padding={20}
      gap={16}
      style={{
        borderRadius: isDesktopWeb ? 32 : undefined,
      }}
    >
      <KitTextField
        label="Name"
        value={nameDraft}
        onChangeText={onNameDraftChange}
        placeholder="Your public name"
        autoCapitalize="words"
        autoCorrect={false}
      />

      <KitTextField
        label="Bio"
        value={bioDraft}
        onChangeText={onBioDraftChange}
        placeholder="Tell people what you teach"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{ minHeight: 92 }}
      />

      {extraField ? (
        <KitTextField
          label={extraField.label}
          value={extraField.value}
          onChangeText={extraField.onChangeText}
          placeholder={extraField.placeholder}
          keyboardType={extraField.keyboardType}
        />
      ) : null}
    </KitSurface>
  );
}
