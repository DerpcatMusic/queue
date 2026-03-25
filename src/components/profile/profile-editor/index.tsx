import { ScrollView, Text, View } from "react-native";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { ProfileEditorActions } from "./profile-editor-actions";
import { ProfileEditorBasicsPanel } from "./profile-editor-basics-panel";
import { ProfileEditorIdentityPanel } from "./profile-editor-identity-panel";
import { ProfileEditorSocialPanel } from "./profile-editor-social-panel";
import type { ProfileEditorFormProps } from "./types";

export function ProfileEditorForm({
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
  contentTopInset = BrandSpacing.lg,
}: ProfileEditorFormProps) {
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { safeBottom } = useAppInsets();
  const { color } = useTheme();

  const saveActions = (
    <ProfileEditorActions onSave={onSave} onCancel={onCancel} isSaving={isSaving} />
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: BrandSpacing.lg,
        paddingTop: contentTopInset,
        paddingBottom: BrandSpacing.xxl + safeBottom,
        gap: BrandSpacing.lg,
      }}
    >
      {isDesktopWeb ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: BrandSpacing.xl,
          }}
        >
          <View style={{ width: 380, gap: BrandSpacing.lg }}>
            <ProfileEditorIdentityPanel
              profileName={profileName}
              roleLabel={roleLabel}
              profileImageUrl={profileImageUrl}
              statusLabel={statusLabel}
              isDesktopWeb={isDesktopWeb}
              isChangingPhoto={isChangingPhoto}
              onChangePhoto={onChangePhoto}
              saveActions={saveActions}
            />
            <ProfileEditorBasicsPanel
              nameDraft={nameDraft}
              onNameDraftChange={onNameDraftChange}
              bioDraft={bioDraft}
              onBioDraftChange={onBioDraftChange}
              extraField={extraField}
              isDesktopWeb={isDesktopWeb}
            />
          </View>

          <View style={{ flex: 1, gap: BrandSpacing.lg }}>
            <SportsMultiSelect
              selectedSports={sportsDraft}
              onToggleSport={onToggleSport}
              searchPlaceholder={searchPlaceholder}
              title={sportsTitle}
              emptyHint={sportsEmptyHint}
            />
            <ProfileEditorSocialPanel
              socialLinksDraft={socialLinksDraft}
              onSocialLinkChange={onSocialLinkChange}
            />
          </View>
        </View>
      ) : (
        <>
          <ProfileEditorIdentityPanel
            profileName={profileName}
            roleLabel={roleLabel}
            profileImageUrl={profileImageUrl}
            statusLabel={statusLabel}
            isDesktopWeb={isDesktopWeb}
            isChangingPhoto={isChangingPhoto}
            onChangePhoto={onChangePhoto}
          />
          <ProfileEditorBasicsPanel
            nameDraft={nameDraft}
            onNameDraftChange={onNameDraftChange}
            bioDraft={bioDraft}
            onBioDraftChange={onBioDraftChange}
            extraField={extraField}
            isDesktopWeb={isDesktopWeb}
          />
          <SportsMultiSelect
            selectedSports={sportsDraft}
            onToggleSport={onToggleSport}
            searchPlaceholder={searchPlaceholder}
            title={sportsTitle}
            emptyHint={sportsEmptyHint}
          />
          <ProfileEditorSocialPanel
            socialLinksDraft={socialLinksDraft}
            onSocialLinkChange={onSocialLinkChange}
          />

          {statusLabel ? (
            <Text
              style={[BrandType.caption, { color: color.textMuted, includeFontPadding: false }]}
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

export type { ProfileEditorFormProps } from "./types";
