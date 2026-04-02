import { useQuery } from "convex/react";
import type { Href } from "expo-router";
import { Stack, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { KitChip } from "@/components/ui/kit/kit-chip";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { sortInstructorJobsBySelectedId } from "@/features/jobs/instructor-marketplace-job";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";

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
    <View
      style={{
        marginHorizontal: BrandSpacing.inset,
        marginTop: BrandSpacing.lg,
        borderRadius: 24,
        borderCurve: "continuous",
        padding: BrandSpacing.lg,
        gap: BrandSpacing.md,
        backgroundColor: color.surfaceElevated,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={studioName}
          size={64}
          roundedSquare={false}
          fallbackIcon="building.2.fill"
        />
        <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
          <ThemedText type="title">{studioName}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {getZoneLabel(zone, i18n.resolvedLanguage?.startsWith("he") ? "he" : "en")}
          </ThemedText>
        </View>
      </View>
      {bio ? <ThemedText style={{ color: color.text }}>{bio}</ThemedText> : null}
    </View>
  );
}

export function PublicStudioProfileScreen() {
  const { studioId, jobId } = useLocalSearchParams<{ studioId: string; jobId?: string }>();
  const { t, i18n } = useTranslation();
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
  const branchBasePath = useMemo(() => {
    const encodedStudioId = encodeURIComponent(String(studioId));
    if (pathname.startsWith(`/instructor/map/studios/${encodedStudioId}`)) {
      return `/instructor/map/studios/${encodedStudioId}/branches`;
    }
    return `/profiles/studios/${encodedStudioId}/branches`;
  }, [pathname, studioId]);

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
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: BrandSpacing.sm,
                paddingHorizontal: BrandSpacing.inset,
              }}
            >
              {sports.map((sport) => (
                <KitChip key={sport} label={sport} selected={false} onPress={() => {}} disabled />
              ))}
            </View>
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
                      `${branchBasePath}/${encodeURIComponent(String(branch.branchId))}` as Href,
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

        <View style={{ paddingHorizontal: BrandSpacing.inset, paddingTop: BrandSpacing.lg }}>
          <ThemedText type="caption" style={{ textAlign: "center" }}>
            {t("publicProfile.backHint", {
              defaultValue: "Use back to return to where you came from.",
            })}
          </ThemedText>
        </View>
      </TabScreenScrollView>
    </>
  );
}
