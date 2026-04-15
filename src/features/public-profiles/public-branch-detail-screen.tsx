import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function PublicBranchDetailScreen() {
  const { studioId, branchId } = useLocalSearchParams<{ studioId: string; branchId: string }>();
  const { t, i18n } = useTranslation();
  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  const profile = useQuery(
    api.studios.publicProfiles.getStudioPublicProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles"> } : "skip",
  );

  if (profile === undefined) {
    return <LoadingScreen />;
  }

  const branch =
    profile?.branches.find((item) => String(item.branchId) === String(branchId)) ?? null;

  if (!profile || !branch) {
    return <LoadingScreen label={t("common.notFound", { defaultValue: "Not found" })} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TabScreenScrollView contentContainerStyle={{ paddingBottom: BrandSpacing.section }}>
        <ProfileSectionHeader
          label={t("publicProfile.branch.header", { defaultValue: "Branch" })}
          description={profile.studioName}
        />
        <ProfileSectionCard>
          <ProfileSettingRow
            title={branch.name}
            icon={branch.isPrimary ? "star.fill" : "building.2"}
            showDivider
            {...(branch.isPrimary
              ? {
                  subtitle: t("publicProfile.studio.primary", { defaultValue: "Primary branch" }),
                }
              : {})}
          />
          <ProfileSettingRow
            title={t("publicProfile.branch.address", { defaultValue: "Address" })}
            value={branch.address}
            icon="mappin.and.ellipse"
            showDivider
          />
          <ProfileSettingRow
            title={t("publicProfile.branch.zone", { defaultValue: "Zone" })}
            value={getZoneLabel(branch.zone, zoneLanguage)}
            icon="map.fill"
            showDivider={Boolean(branch.contactPhone)}
          />
          {branch.contactPhone ? (
            <ProfileSettingRow
              title={t("publicProfile.branch.phone", { defaultValue: "Phone" })}
              value={branch.contactPhone}
              icon="phone"
            />
          ) : null}
        </ProfileSectionCard>

        <ProfileSectionHeader
          label={t("publicProfile.branch.aboutStudio", { defaultValue: "Organization" })}
        />
        <ProfileSectionCard>
          <ProfileSettingRow
            title={profile.studioName}
            value={
              profile.branches.length === 1
                ? t("publicProfile.branch.singleBranch", { defaultValue: "Single branch" })
                : t("publicProfile.branch.branchCount", {
                    count: profile.branches.length,
                    defaultValue: "{{count}} branches",
                  })
            }
            icon="building.2.crop.circle"
          />
        </ProfileSectionCard>

        <ThemedText
          type="caption"
          style={{
            textAlign: "center",
            marginTop: BrandSpacing.lg,
            paddingHorizontal: BrandSpacing.inset,
          }}
        >
          {t("publicProfile.backHint", {
            defaultValue: "Use back to return to where you came from.",
          })}
        </ThemedText>
      </TabScreenScrollView>
    </>
  );
}
