import { toSportLabel } from "@/convex/constants";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeList, NativeListItem } from "@/components/ui/native-list";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import type { JobStatus } from "@/lib/status-tokens";
import {
  CONTENT_VERTICAL_PADDING,
  HeroBlock,
  PrimaryActionCard,
  StatusPill,
} from "@/components/home/home-shared";
import type { TFunction } from "i18next";
import { ScrollView, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

type RecentJob = {
  jobId: string;
  sport: string;
  status: JobStatus;
  zone: string;
  startTime: number;
  pay: number;
};

type StudioHomeContentProps = {
  displayName: string;
  memberSince: string;
  locale: string;
  openJobs: number;
  pendingApplicants: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  recentJobs: RecentJob[];
  onOpenJobs: () => void;
  isDataLoading: boolean;
};

export function StudioHomeContent({
  displayName,
  memberSince,
  locale,
  openJobs,
  pendingApplicants,
  palette,
  currencyFormatter,
  t,
  recentJobs,
  onOpenJobs,
  isDataLoading,
}: StudioHomeContentProps) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{
        paddingHorizontal: BrandSpacing.lg,
        paddingVertical: CONTENT_VERTICAL_PADDING,
        gap: BrandSpacing.lg,
      }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <HeroBlock
        title={t("home.studio.greeting", { name: displayName })}
        subtitle={isDataLoading ? t("home.loading") : memberSince}
        palette={palette}
        metrics={[
          { label: t("home.studio.stats.openLabel"), value: openJobs },
          { label: t("home.studio.stats.pendingLabel"), value: pendingApplicants },
          { label: t("home.studio.stats.postedLabel"), value: recentJobs.length },
        ]}
      />

      {pendingApplicants > 0 ? (
        <PrimaryActionCard
          title={t("home.actions.jobsTitle")}
          subtitle={t("jobsTab.applicationSummary", { count: pendingApplicants })}
          icon="briefcase.fill"
          onPress={onOpenJobs}
          palette={palette}
        />
      ) : openJobs > 0 ? (
        <PrimaryActionCard
          title={t("home.actions.jobsTitle")}
          subtitle={t("home.actions.studioJobsSubtitle", { count: openJobs })}
          icon="briefcase.fill"
          onPress={onOpenJobs}
          palette={palette}
        />
      ) : null}

      <Animated.View entering={FadeInUp.delay(200).duration(360).springify()}>
        <View style={{ gap: BrandSpacing.xs, marginBottom: BrandSpacing.sm, paddingHorizontal: BrandSpacing.xs }}>
          <ThemedText type="title">{t("home.studio.recentTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {t("home.studio.subtitle")}
          </ThemedText>
        </View>

        {recentJobs.length === 0 ? (
          <EmptyState
            icon="bag.badge.plus"
            title={t("home.studio.noRecent")}
            body={t("home.actions.studioJobsSubtitle", { count: openJobs })}
            action={{
              label: t("home.actions.jobsTitle"),
              icon: "plus",
              onPress: onOpenJobs,
            }}
          />
        ) : (
          <NativeList inset>
            {recentJobs.slice(0, 3).map((job) => (
              <NativeListItem
                key={job.jobId}
                title={toSportLabel(job.sport as never)}
                accessory={
                  <StatusPill
                    label={t(`jobsTab.status.job.${job.status}`)}
                    status={job.status}
                    palette={palette}
                  />
                }
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                  <ThemedText type="caption" style={{ color: palette.textMuted }} numberOfLines={1}>
                    {job.zone} • {new Date(job.startTime).toLocaleDateString(locale)}
                  </ThemedText>
                  <ThemedText type="bodyStrong" style={{ color: palette.text, fontVariant: ["tabular-nums"] }}>
                    {currencyFormatter.format(job.pay)}
                  </ThemedText>
                </View>
              </NativeListItem>
            ))}
          </NativeList>
        )}
      </Animated.View>
    </ScrollView>
  );
}
