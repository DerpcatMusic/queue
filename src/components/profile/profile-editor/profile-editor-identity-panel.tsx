import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { KitSurface } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type ProfileEditorIdentityPanelProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  statusLabel?: string | null | undefined;
  isDesktopWeb: boolean;
  isChangingPhoto: boolean;
  onChangePhoto: () => void;
  saveActions?: React.ReactNode | undefined;
};

export function ProfileEditorIdentityPanel({
  profileName,
  roleLabel,
  profileImageUrl,
  statusLabel,
  isDesktopWeb,
  isChangingPhoto,
  onChangePhoto,
  saveActions,
}: ProfileEditorIdentityPanelProps) {
  const { t } = useTranslation();
  const { color } = useTheme();

  return (
    <KitSurface
      tone="base"
      padding={BrandSpacing.xl}
      gap={BrandSpacing.lg}
      style={
        isDesktopWeb
          ? {
              backgroundColor: color.primary,
            }
          : undefined
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.lg }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          size={BrandSpacing.iconContainerLarge - BrandSpacing.xs / 2}
          roundedSquare
        />
        <View style={{ flex: 1, gap: BrandSpacing.xs }}>
          <Text
            style={[
              BrandType.micro,
              {
                color: isDesktopWeb ? color.onPrimary : color.textMuted,
                includeFontPadding: false,
              },
            ]}
          >
            {roleLabel}
          </Text>
          <Text
            style={[
              isDesktopWeb ? BrandType.display : BrandType.title,
              {
                color: isDesktopWeb ? color.onPrimary : color.text,
                includeFontPadding: false,
              },
            ]}
          >
            {profileName}
          </Text>
          {statusLabel ? (
            <Text
              style={[
                BrandType.micro,
                {
                  color: isDesktopWeb ? color.onPrimary : color.textMuted,
                  includeFontPadding: false,
                },
              ]}
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
        <ActionButton
          label={isChangingPhoto ? t("profile.editor.uploading") : t("profile.editor.photo")}
          onPress={onChangePhoto}
          disabled={isChangingPhoto}
          tone="secondary"
        />
      </View>

      {isDesktopWeb ? saveActions : null}
    </KitSurface>
  );
}
