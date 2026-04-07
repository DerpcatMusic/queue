import { useTranslation } from "react-i18next";
import { ActionButton } from "@/components/ui/action-button";
import { BrandSpacing } from "@/constants/brand";
import { Box } from "@/primitives";

type ProfileEditorActionsProps = {
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function ProfileEditorActions({ onSave, onCancel, isSaving }: ProfileEditorActionsProps) {
  const { t } = useTranslation();

  return (
    <Box style={{ flexDirection: "row", gap: BrandSpacing.md }}>
      <Box style={{ flex: 1 }}>
        <ActionButton
          label={isSaving ? t("profile.editor.saving") : t("profile.editor.save")}
          onPress={onSave}
          disabled={isSaving}
          fullWidth
        />
      </Box>
      <Box style={{ flex: 1 }}>
        <ActionButton
          label={t("profile.editor.cancel")}
          onPress={onCancel}
          disabled={isSaving}
          tone="secondary"
          fullWidth
        />
      </Box>
    </Box>
  );
}
