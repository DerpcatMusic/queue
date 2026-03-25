import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { KitSurface } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";

type ProfileEditorIdentityPanelProps = {
  palette: BrandPalette;
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
  palette,
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

  return (
    <KitSurface
      tone="base"
      padding={BrandSpacing.xl}
      gap={BrandSpacing.lg}
      style={
        isDesktopWeb
          ? {
              backgroundColor: palette.primary as string,
            }
          : undefined
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.lg }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          palette={palette}
          size={BrandSpacing.iconContainerLarge - BrandSpacing.xs / 2}
          roundedSquare
        />
        <View style={{ flex: 1, gap: BrandSpacing.xs }}>
          <Text
            style={{
              ...BrandType.bodyMedium,
              fontSize: 13,
              color: isDesktopWeb ? (palette.onPrimary as string) : (palette.textMuted as string),
              includeFontPadding: false,
            }}
          >
            {roleLabel}
          </Text>
          <Text
            style={{
              ...(isDesktopWeb ? BrandType.display : BrandType.title),
              fontSize: isDesktopWeb ? 32 : 20,
              lineHeight: isDesktopWeb ? 30 : undefined,
              color: isDesktopWeb ? (palette.onPrimary as string) : (palette.text as string),
              includeFontPadding: false,
              letterSpacing: isDesktopWeb ? -0.8 : 0,
            }}
          >
            {profileName}
          </Text>
          {statusLabel ? (
            <Text
              style={{
                ...BrandType.bodyMedium,
                fontSize: 13,
                color: isDesktopWeb ? (palette.onPrimary as string) : (palette.textMuted as string),
                includeFontPadding: false,
              }}
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
        <ActionButton
          label={isChangingPhoto ? t("profile.editor.uploading") : t("profile.editor.photo")}
          onPress={onChangePhoto}
          disabled={isChangingPhoto}
          palette={palette}
          tone="secondary"
        />
      </View>

      {isDesktopWeb ? saveActions : null}
    </KitSurface>
  );
}
