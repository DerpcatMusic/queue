import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";

type ProfileEditorActionsProps = {
  palette: BrandPalette;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function ProfileEditorActions({
  palette,
  onSave,
  onCancel,
  isSaving,
}: ProfileEditorActionsProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
      <View style={{ flex: 1 }}>
        <ActionButton
          label={isSaving ? t("profile.editor.saving") : t("profile.editor.save")}
          onPress={onSave}
          disabled={isSaving}
          palette={palette}
          fullWidth
        />
      </View>
      <View style={{ flex: 1 }}>
        <ActionButton
          label={t("profile.editor.cancel")}
          onPress={onCancel}
          disabled={isSaving}
          palette={palette}
          tone="secondary"
          fullWidth
        />
      </View>
    </View>
  );
}
