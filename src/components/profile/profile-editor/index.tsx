import { View } from "react-native";
import { ProfileSubpageScrollView } from "@/components/profile/profile-subpage-sheet";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
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
}: ProfileEditorFormProps) {
  const { isDesktopWeb } = useLayoutBreakpoint();
  const { color } = useTheme();

  const saveActions = (
    <ProfileEditorActions onSave={onSave} onCancel={onCancel} isSaving={isSaving} />
  );

  return (
    <ProfileSubpageScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: BrandSpacing.lg,
      }}
      topSpacing={BrandSpacing.lg}
      bottomSpacing={BrandSpacing.xxl}
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
    </ProfileSubpageScrollView>
  );
}

export type { ProfileEditorFormProps } from "./types";
