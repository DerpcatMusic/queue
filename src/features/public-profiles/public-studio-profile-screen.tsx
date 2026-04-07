import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";

import { ThemedText } from "@/components/themed-text";
import { KitPressable } from "@/components/ui/kit/kit-pressable";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { sortInstructorJobsBySelectedId } from "@/features/jobs/instructor-marketplace-job";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import {
  buildStudioBranchRoute,
  resolveStudioProfileOwner,
} from "@/navigation/public-profile-routes";
import { Box } from "@/primitives";

function StudioHeader({
  studioName,
  profileImageUrl,
  zone,
  bio,
}: {
  studioName: string;
  profileImageUrl?: string | undefined;
  zone: string;
  bio?: string | undefined;
}) {
  const { color } = useTheme();
  const { i18n } = useTranslation();

  return (
    <Box
      style={{
        marginHorizontal: BrandSpacing.inset,
        marginTop: BrandSpacing.lg,
        borderRadius: BrandRadius.soft,
        borderCurve: "continuous",
        padding: BrandSpacing.lg,
        gap: BrandSpacing.md,
        backgroundColor: color.surfaceElevated,
      }}
    >
      <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={studioName}
          size={64}
          roundedSquare={false}
          fallbackIcon="building.2.fill"
          accessibilityLabel={studioName}
        />
        <Box style={{ flex: 1, gap: BrandSpacing.xxs }}>
          <ThemedText type="title">{studioName}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {getZoneLabel(zone, i18n.resolvedLanguage?.startsWith("he") ? "he" : "en")}
          </ThemedText>
        </Box>
      </Box>
      {bio ? <ThemedText style={{ color: color.text }}>{bio}</ThemedText> : null}
    </Box>
  );
}

export function PublicStudioProfileScreen() {
  const { studioId, jobId } = useLocalSearchParams<{ studioId: string; jobId?: string }>();
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const now = useMinuteNow();
  const profile = useQuery(
    api.users.getStudioPublicProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles"> } : "skip",
  );
  const jobsProfile = useQuery(
    api.jobs.getStudioProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles">, now } : "skip",
  );
  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  const sports = useMemo(
    () => (profile?.sports ?? []).map((sport) => toSportLabel(sport as never)),
    [profile?.sports],
  );
  const prioritizedJobs = useMemo(
    () => sortInstructorJobsBySelectedId(jobsProfile?.jobs ?? [], jobId ?? null),
    [jobId, jobsProfile?.jobs],
  );
  const studioRouteOwner = useMemo(() => resolveStudioProfileOwner(pathname), [pathname]);

  if (profile === undefined || jobsProfile === undefined) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return <LoadingScreen label={t("common.notFound", { defaultValue: "Not found" })} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TabScreenScrollView contentContainerStyle={{ paddingBottom: BrandSpacing.section }}>
        <StudioHeader
          studioName={profile.studioName}
          profileImageUrl={profile.profileImageUrl}
          zone={profile.zone}
          bio={profile.bio}
        />

        <ProfileSectionHeader
          label={t("publicProfile.studio.about", { defaultValue: "Studio profile" })}
          description={t("publicProfile.studio.aboutHint", {
            defaultValue: "A public view of the studio, independent from the jobs tab.",
          })}
        />
        <ProfileSectionCard>
          <ProfileSettingRow
            title={t("publicProfile.studio.location", { defaultValue: "Location" })}
            value={getZoneLabel(profile.zone, zoneLanguage)}
            icon="mappin.and.ellipse"
            showDivider
          />
          <ProfileSettingRow
            title={t("publicProfile.studio.address", { defaultValue: "Address" })}
            value={profile.address}
            icon="building.2"
            showDivider={Boolean(profile.contactPhone)}
          />
          {profile.contactPhone ? (
            <ProfileSettingRow
              title={t("publicProfile.studio.phone", { defaultValue: "Phone" })}
              value={profile.contactPhone}
              icon="phone"
            />
          ) : null}
        </ProfileSectionCard>

        {sports.length > 0 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.studio.sports", { defaultValue: "Sports" })}
            />
            <Box
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: BrandSpacing.sm,
                paddingHorizontal: BrandSpacing.inset,
              }}
            >
              {sports.map((sport) => {
                const bgColor = color.surface;
                const pressedBgColor = color.surface;
                const textColor = color.textMuted;
                return (
                  <KitPressable
                    key={sport}
                    accessibilityRole="none"
                    accessibilityHint={t("publicProfile.studio.sportChipHint", {
                      defaultValue: "Sport offered by this studio",
                    })}
                    disabled
                    haptic={false}
                    onPress={() => {
                      triggerSelectionHaptic();
                    }}
                    style={{
                      tone: "surface",
                      variant: "solid",
                      size: {
                        minHeight: BrandSpacing.controlSm,
                        borderRadius: BrandRadius.buttonSubtle,
                      },
                      padding: {
                        horizontal: BrandSpacing.controlX,
                        vertical: BrandSpacing.sm,
                      },
                      backgroundColor: bgColor,
                      pressedBackgroundColor: pressedBgColor,
                    }}
                  >
                    <Text
                      style={[BrandType.micro, { color: textColor, includeFontPadding: false }]}
                    >
                      {sport}
                    </Text>
                  </KitPressable>
                );
              })}
            </Box>
          </>
        ) : null}

        {profile.branches.length > 1 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.studio.organization", { defaultValue: "Organization" })}
              description={t("publicProfile.studio.organizationHint", {
                defaultValue: "This studio operates multiple branches.",
              })}
            />
            <ProfileSectionCard>
              {profile.branches.map((branch, index) => (
                <ProfileSettingRow
                  key={String(branch.branchId)}
                  title={branch.name}
                  subtitle={branch.address}
                  value={
                    branch.isPrimary
                      ? t("publicProfile.studio.primary", { defaultValue: "Primary" })
                      : getZoneLabel(branch.zone, zoneLanguage)
                  }
                  icon={branch.isPrimary ? "star.fill" : "mappin.circle"}
                  onPress={() =>
                    router.push(
                      buildStudioBranchRoute({
                        owner: studioRouteOwner,
                        studioId: String(profile.studioId),
                        branchId: String(branch.branchId),
                      }),
                    )
                  }
                  showDivider={index < profile.branches.length - 1}
                />
              ))}
            </ProfileSectionCard>
          </>
        ) : null}

        {prioritizedJobs.length ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.studio.openJobs", { defaultValue: "Open jobs" })}
              description={t("publicProfile.studio.openJobsHint", {
                count: prioritizedJobs.length,
                defaultValue: "{{count}} open jobs currently listed by this studio.",
              })}
            />
            <ProfileSectionCard>
              {prioritizedJobs.slice(0, 5).map((job, index) => (
                <ProfileSettingRow
                  key={String(job.jobId)}
                  title={toSportLabel(job.sport as never)}
                  subtitle={job.branchName}
                  value={
                    jobId && String(job.jobId) === String(jobId)
                      ? t("publicProfile.studio.selectedJob", { defaultValue: "Selected job" })
                      : getZoneLabel(job.zone, zoneLanguage)
                  }
                  icon="briefcase.fill"
                  showDivider={index < Math.min(prioritizedJobs.length, 5) - 1}
                />
              ))}
            </ProfileSectionCard>
          </>
        ) : null}

        <Box style={{ paddingHorizontal: BrandSpacing.inset, paddingTop: BrandSpacing.lg }}>
          <ThemedText type="caption" style={{ textAlign: "center" }}>
            {t("publicProfile.backHint", {
              defaultValue: "Use back to return to where you came from.",
            })}
          </ThemedText>
        </Box>
      </TabScreenScrollView>
    </>
  );
}
