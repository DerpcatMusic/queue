import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import {
  PROFILE_SOCIAL_FIELDS,
  type ProfileSocialKey,
  type ProfileSocialLinks,
} from "@/components/profile/profile-social-links";
import { KitSurface, KitTextField } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
type ProfileEditorSocialPanelProps = {
  socialLinksDraft: ProfileSocialLinks;
  onSocialLinkChange: (key: ProfileSocialKey, value: string) => void;
};

export function ProfileEditorSocialPanel({
  socialLinksDraft,
  onSocialLinkChange,
}: ProfileEditorSocialPanelProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const activeSocialCount = useMemo(
    () =>
      PROFILE_SOCIAL_FIELDS.filter((field) => Boolean(socialLinksDraft[field.key]?.trim())).length,
    [socialLinksDraft],
  );
  const [showSocialFields, setShowSocialFields] = useState(activeSocialCount > 0);

  return (
    <KitSurface tone="base" padding={BrandSpacing.insetRoomy} gap={BrandSpacing.component}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: BrandSpacing.md,
        }}
      >
        <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
          <Text style={[BrandType.title, { color: color.text, includeFontPadding: false }]}>
            {t("profile.editor.socialLinks")}
          </Text>
          <Text style={[BrandType.caption, { color: color.textMuted, includeFontPadding: false }]}>
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
            backgroundColor: pressed ? color.primaryPressed : color.primary,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            shadowColor: color.shadow,
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 1,
          })}
        >
          <Text style={[BrandType.title, { color: color.onPrimary, includeFontPadding: false }]}>
            {showSocialFields ? t("profile.editor.hide") : t("common.edit")}
          </Text>
        </Pressable>
      </View>

      {showSocialFields ? (
        <View style={{ gap: BrandSpacing.md }}>
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
