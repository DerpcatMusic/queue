import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import {
  PROFILE_SOCIAL_FIELDS,
  type ProfileSocialKey,
  type ProfileSocialLinks,
} from "@/components/profile/profile-social-links";
import { KitSurface, KitTextField } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";
import { BrandType } from "@/constants/brand";

type ProfileEditorSocialPanelProps = {
  palette: BrandPalette;
  socialLinksDraft: ProfileSocialLinks;
  onSocialLinkChange: (key: ProfileSocialKey, value: string) => void;
};

export function ProfileEditorSocialPanel({
  palette,
  socialLinksDraft,
  onSocialLinkChange,
}: ProfileEditorSocialPanelProps) {
  const { t } = useTranslation();
  const activeSocialCount = useMemo(
    () =>
      PROFILE_SOCIAL_FIELDS.filter((field) => Boolean(socialLinksDraft[field.key]?.trim())).length,
    [socialLinksDraft],
  );
  const [showSocialFields, setShowSocialFields] = useState(activeSocialCount > 0);

  return (
    <KitSurface tone="base" padding={20} gap={14}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              ...BrandType.title,
              fontSize: 16,
              color: palette.text as string,
              includeFontPadding: false,
            }}
          >
            {t("profile.editor.socialLinks")}
          </Text>
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMuted as string,
              includeFontPadding: false,
            }}
          >
            {activeSocialCount > 0
              ? t("profile.editor.linked", { count: activeSocialCount })
              : t("profile.editor.addLinks")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showSocialFields ? t("profile.editor.hide") : t("common.edit")}
          onPress={() => setShowSocialFields((value) => !value)}
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? (palette.surfaceAlt as string)
              : (palette.surfaceElevated as string),
            paddingHorizontal: 6,
            paddingVertical: 4,
            borderRadius: 10,
          })}
        >
          <Text
            style={{
              ...BrandType.bodyMedium,
              color: palette.primary as string,
              includeFontPadding: false,
            }}
          >
            {showSocialFields ? t("profile.editor.hide") : t("common.edit")}
          </Text>
        </Pressable>
      </View>

      {showSocialFields ? (
        <View style={{ gap: 12 }}>
          {PROFILE_SOCIAL_FIELDS.map((field) => (
            <KitTextField
              key={field.key}
              label={field.label}
              value={socialLinksDraft[field.key] ?? ""}
              onChangeText={(value) => onSocialLinkChange(field.key, value)}
              placeholder={field.label}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ))}
        </View>
      ) : null}
    </KitSurface>
  );
}
