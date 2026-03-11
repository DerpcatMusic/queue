import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, type TextInputProps, View } from "react-native";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";

import {
  PROFILE_SOCIAL_FIELDS,
  type ProfileSocialKey,
  type ProfileSocialLinks,
} from "@/components/profile/profile-social-links";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { KitButton, KitSurface, KitTextField } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";

type EditableExtraField = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
};

type ProfileEditorFormProps = {
  palette: BrandPalette;
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  bioDraft: string;
  onBioDraftChange: (value: string) => void;
  socialLinksDraft: ProfileSocialLinks;
  onSocialLinkChange: (key: ProfileSocialKey, value: string) => void;
  sportsDraft: string[];
  onToggleSport: (sport: string) => void;
  onChangePhoto: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  isChangingPhoto?: boolean;
  statusLabel?: string | null;
  searchPlaceholder: string;
  sportsTitle: string;
  sportsEmptyHint: string;
  extraField?: EditableExtraField;
};

export function ProfileEditorForm({
  palette,
  profileName,
  roleLabel,
  profileImageUrl,
  nameDraft,
  onNameDraftChange,
  bioDraft,
  onBioDraftChange,
  socialLinksDraft,
  onSocialLinkChange,
  sportsDraft,
  onToggleSport,
  onChangePhoto,
  onCancel,
  onSave,
  isSaving = false,
  isChangingPhoto = false,
  statusLabel,
  searchPlaceholder,
  sportsTitle,
  sportsEmptyHint,
  extraField,
}: ProfileEditorFormProps) {
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { t } = useTranslation();
  const activeSocialCount = useMemo(
    () =>
      PROFILE_SOCIAL_FIELDS.filter((field) => Boolean(socialLinksDraft[field.key]?.trim())).length,
    [socialLinksDraft],
  );
  const [showSocialFields, setShowSocialFields] = useState(activeSocialCount > 0);
  const saveActions = (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <KitButton
          label={isSaving ? t("profile.editor.saving") : t("profile.editor.save")}
          onPress={onSave}
          disabled={isSaving}
        />
      </View>
      <View style={{ flex: 1 }}>
        <KitButton
          label={t("profile.editor.cancel")}
          onPress={onCancel}
          variant="secondary"
          disabled={isSaving}
        />
      </View>
    </View>
  );

  const identityPanel = (
    <KitSurface
      tone="base"
      padding={24}
      gap={18}
      style={
        isDesktopWeb
          ? {
              backgroundColor: palette.primary as string,
            }
          : undefined
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          palette={palette}
          size={76}
          roundedSquare
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              ...BrandType.bodyMedium,
              fontSize: 13,
              color: isDesktopWeb ? (palette.onPrimary as string) : (palette.textMuted as string),
              includeFontPadding: false,
              opacity: isDesktopWeb ? 0.76 : 1,
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
                opacity: isDesktopWeb ? 0.76 : 1,
              }}
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
        <KitButton
          label={isChangingPhoto ? t("profile.editor.uploading") : t("profile.editor.photo")}
          onPress={onChangePhoto}
          variant="secondary"
          size="sm"
          disabled={isChangingPhoto}
          fullWidth={false}
          style={
            isDesktopWeb
              ? {
                  backgroundColor: palette.surface as string,
                }
              : undefined
          }
        />
      </View>

      {isDesktopWeb ? saveActions : null}
    </KitSurface>
  );

  const basicsPanel = (
    <KitSurface
      tone="base"
      padding={20}
      gap={16}
      style={{
        borderRadius: isDesktopWeb ? 32 : undefined,
      }}
    >
      <KitTextField
        label={t("profile.editor.nameLabel")}
        value={nameDraft}
        onChangeText={onNameDraftChange}
        placeholder={t("profile.editor.namePlaceholder")}
        autoCapitalize="words"
        autoCorrect={false}
      />

      <KitTextField
        label={t("profile.editor.bioLabel")}
        value={bioDraft}
        onChangeText={onBioDraftChange}
        placeholder={t("profile.editor.bioPlaceholder")}
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

  const socialPanel = (
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
        <KitButton
          label={showSocialFields ? t("profile.editor.hide") : t("common.edit")}
          onPress={() => setShowSocialFields((value) => !value)}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: BrandSpacing.lg,
        paddingTop: BrandSpacing.lg,
        paddingBottom: BrandSpacing.xxl,
        gap: BrandSpacing.lg,
      }}
    >
      {isDesktopWeb ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: BrandSpacing.xl }}>
          <View style={{ width: 380, gap: BrandSpacing.lg }}>
            {identityPanel}
            {basicsPanel}
          </View>

          <View style={{ flex: 1, gap: BrandSpacing.lg }}>
            <SportsMultiSelect
              palette={palette}
              selectedSports={sportsDraft}
              onToggleSport={onToggleSport}
              searchPlaceholder={searchPlaceholder}
              title={sportsTitle}
              emptyHint={sportsEmptyHint}
            />
            {socialPanel}
          </View>
        </View>
      ) : (
        <>
          {identityPanel}
          {basicsPanel}
          <SportsMultiSelect
            palette={palette}
            selectedSports={sportsDraft}
            onToggleSport={onToggleSport}
            searchPlaceholder={searchPlaceholder}
            title={sportsTitle}
            emptyHint={sportsEmptyHint}
          />
          {socialPanel}

          {statusLabel ? (
            <Text
              style={{
                ...BrandType.caption,
                lineHeight: 18,
                color: palette.textMuted as string,
                includeFontPadding: false,
              }}
            >
              {statusLabel}
            </Text>
          ) : null}

          {saveActions}
        </>
      )}
    </ScrollView>
  );
}
