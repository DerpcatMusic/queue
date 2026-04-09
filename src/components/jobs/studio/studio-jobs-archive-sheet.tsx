import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { getBoostPresentation } from "@/lib/jobs-utils";
import { Box, HStack, VStack } from "@/primitives";
import { Motion, Spring } from "@/theme/theme";
import type { StudioJob } from "./studio-jobs-list.types";

type StudioJobsArchiveSheetProps = {
  innerRef: React.RefObject<BottomSheet | null>;
  onDismissed: () => void;
  jobs: StudioJob[];
  locale: string;
  zoneLanguage: "en" | "he";
};

function formatArchivePay(locale: string, amount: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(amount);
}

function StudioArchiveRow({
  job,
  expanded,
  onToggle,
  locale,
  zoneLanguage,
  t,
  index,
  onOpenReceipt,
}: {
  job: StudioJob;
  expanded: boolean;
  onToggle: () => void;
  locale: string;
  zoneLanguage: "en" | "he";
  t: ReturnType<typeof useTranslation>["t"];
  index: number;
  onOpenReceipt?: () => void;
}) {
  const theme = useTheme();
  const sportLabel = useMemo(() => toSportLabel(job.sport as never), [job.sport]);
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const payLabel = formatArchivePay(locale, job.pay);
  const boost = getBoostPresentation(
    job.pay,
    job.boostPreset,
    job.boostBonusAmount,
    job.boostActive,
  );
  const hasBonus = Boolean(boost.bonusAmount && boost.bonusAmount > 0);

  // Status tone
  const isCompleted = job.status === "completed";
  const isCancelled = job.status === "cancelled";
  const isFilled = job.status === "filled";

  const accentColor = isCompleted
    ? theme.archive.paid
    : isCancelled
      ? theme.archive.cancelled
      : theme.archive.pending;

  // Payment info
  const paymentStatus = job.payment?.status;
  const payoutStatus = job.payment?.payoutStatus;
  const isPaidToStudio = paymentStatus === "captured" || paymentStatus === "authorized";
  const paymentLabel = isPaidToStudio
    ? t("jobsTab.checkout.paymentStatus.captured")
    : t("jobsTab.checkout.paymentStatus.pending");

  // Hired count
  const hiredCount = job.applications?.filter((a) => a.status === "accepted").length ?? 0;

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 8) * Motion.staggerBase)
        .springify()
        .damping(Spring.standard.damping)}
    >
      <View
        style={{
          borderRadius: BrandRadius.lg,
          borderCurve: "continuous",
          backgroundColor: theme.archive.surface,
          overflow: "hidden",
        }}
      >
        {/* Top accent stripe */}
        <View
          style={{
            height: 3,
            backgroundColor: accentColor,
            borderRadius: BrandRadius.pill,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sportLabel} ${zoneLabel}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={({ pressed }) => ({
            backgroundColor: pressed ? theme.color.surfaceAlt : theme.archive.surface,
          })}
        >
          <Box p="lg" gap="sm">
            {/* Header: sport + zone */}
            <HStack justify="between" align="start">
              <VStack gap="xxs">
                <ThemedText type="title" style={{ color: theme.archive.accent }} numberOfLines={1}>
                  {sportLabel}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.color.textMuted }}
                  numberOfLines={1}
                >
                  {zoneLabel}
                </ThemedText>
              </VStack>

              <VStack align="end" gap="xs">
                <HStack gap="xxs" align="center">
                  <IconSymbol name="banknote" size={14} color={theme.archive.pay} />
                  <ThemedText type="bodyStrong" style={{ color: theme.archive.pay }}>
                    ₪{payLabel}
                  </ThemedText>
                </HStack>
                <IconSymbol
                  name={expanded ? "chevron.down" : "chevron.right"}
                  size={16}
                  color={theme.color.textMuted}
                />
              </VStack>
            </HStack>

            {/* Date & time + status chip */}
            <HStack gap="sm" align="center">
              <IconSymbol name="calendar" size={12} color={theme.color.textMuted} />
              <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                {new Date(job.startTime).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                ·{" "}
                {new Date(job.startTime).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                –
                {new Date(job.endTime).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
              <StatusPill
                label={
                  isCompleted
                    ? t("jobsTab.status.job.completed")
                    : isCancelled
                      ? t("jobsTab.status.job.cancelled")
                      : isFilled
                        ? t("jobsTab.status.job.filled")
                        : job.status
                }
                tone={isCompleted ? "success" : isCancelled ? "cancelled" : "pending"}
              />
            </HStack>
          </Box>
        </Pressable>

        {/* Expanded details */}
        {expanded ? (
          <View
            style={{
              gap: BrandSpacing.sm,
              backgroundColor: theme.archive.surfaceElevated,
              paddingHorizontal: BrandSpacing.lg,
              paddingBottom: BrandSpacing.lg,
              paddingTop: BrandSpacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.color.border,
            }}
          >
            {/* Payment status */}
            <StudioDetailRow
              icon={isPaidToStudio ? "checkmark.circle.fill" : "clock.fill"}
              label={t("jobsTab.checkout.payment")}
              value={paymentLabel}
              valueColor={isPaidToStudio ? theme.archive.paid : theme.archive.pending}
              theme={theme}
            />

            {/* Payout status (if available) */}
            {payoutStatus && (
              <StudioDetailRow
                icon="building.columns"
                label={t("jobsTab.checkout.payout")}
                value={t(`jobsTab.checkout.payoutStatus.${payoutStatus}`)}
                valueColor={payoutStatus === "paid" ? theme.archive.paid : theme.color.text}
                theme={theme}
              />
            )}

            {/* Bonus earned */}
            <StudioDetailRow
              icon="sparkles"
              label={t("jobsTab.archive.bonusEarned")}
              value={hasBonus ? `+₪${boost.bonusAmount}` : t("jobsTab.archive.noBonus")}
              valueColor={hasBonus ? theme.archive.accent : theme.color.textMuted}
              theme={theme}
            />

            {/* Applications / hires */}
            <StudioDetailRow
              icon="person.2"
              label={t("jobsTab.archive.instructors")}
              value={
                hiredCount > 0
                  ? `${hiredCount} ${t("jobsTab.archive.hired")}`
                  : `${job.applicationsCount} ${t("jobsTab.archive.applicants")}`
              }
              valueColor={theme.color.text}
              theme={theme}
            />

            {/* Closure reason (if cancelled) */}
            {isCancelled && job.closureReason && (
              <StudioDetailRow
                icon="exclamationmark.circle"
                label={t("jobsTab.archive.closureReason")}
                value={t(`jobsTab.closureReason.${job.closureReason}`)}
                valueColor={theme.archive.cancelled}
                theme={theme}
              />
            )}

            {/* Receipt placeholder */}
            <Pressable
              accessibilityRole={onOpenReceipt ? "button" : undefined}
              disabled={!onOpenReceipt}
              onPress={onOpenReceipt}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                paddingTop: BrandSpacing.sm,
              }}
            >
              <View
                style={{
                  width: BrandSpacing.control,
                  height: BrandSpacing.control,
                  borderRadius: BrandRadius.card,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.color.surfaceAlt,
                }}
              >
                <IconSymbol name="doc.text" size={16} color={theme.color.textMuted} />
              </View>
              <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {t("jobsTab.archive.receipt")}
                </ThemedText>
                <ThemedText
                  type="bodyMedium"
                  style={{ color: onOpenReceipt ? theme.archive.accent : theme.color.textMuted }}
                >
                  {onOpenReceipt ? t("profile.payments.openReceipt") : t("jobsTab.archive.receiptComingSoon")}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "success" | "pending" | "cancelled" }) {
  const theme = useTheme();
  const backgroundColor =
    tone === "success"
      ? theme.archive.paidSubtle
      : tone === "cancelled"
        ? theme.archive.cancelledSubtle
        : theme.archive.pendingSubtle;
  const color =
    tone === "success"
      ? theme.archive.paid
      : tone === "cancelled"
        ? theme.archive.cancelled
        : theme.archive.pending;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        backgroundColor,
        paddingHorizontal: BrandSpacing.control,
        paddingVertical: BrandSpacing.xxs,
        gap: BrandSpacing.xxs,
      }}
    >
      <IconSymbol
        name={
          tone === "success"
            ? "checkmark.circle.fill"
            : tone === "cancelled"
              ? "xmark.circle.fill"
              : "clock.fill"
        }
        size={11}
        color={color}
      />
      <ThemedText type="micro" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function StudioDetailRow({
  icon,
  label,
  value,
  valueColor,
  theme,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
  valueColor: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: BrandSpacing.md }}>
      <View
        style={{
          width: BrandSpacing.control,
          height: BrandSpacing.control,
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.color.surfaceAlt,
        }}
      >
        <IconSymbol name={icon} size={16} color={theme.archive.accent} />
      </View>
      <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
        <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
          {label}
        </ThemedText>
        <ThemedText type="bodyMedium" style={{ color: valueColor }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

export function StudioJobsArchiveSheet({
  innerRef,
  onDismissed,
  jobs,
  locale,
  zoneLanguage,
}: StudioJobsArchiveSheetProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const snapPoints = ["88%"];

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => b.startTime - a.startTime);
  }, [jobs]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: theme.color.overlay }]}
      />
    ),
    [theme.color.overlay],
  );

  const toggleExpanded = useCallback((jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId));
  }, []);

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onClose={onDismissed}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.color.borderStrong }}
      backgroundStyle={{ backgroundColor: theme.color.surface }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.md,
        }}
      >
        {/* Header */}
        <HStack justify="between" align="center">
          <VStack gap="xxs">
            <ThemedText type="heading">{t("jobsTab.archiveTitle")}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
              {t("jobsTab.instructorFeed.archiveSubtitle")}
            </ThemedText>
          </VStack>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: BrandRadius.medium,
              backgroundColor: theme.archive.accentSubtle,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconSymbol name="archivebox.fill" size={20} color={theme.archive.accent} />
          </View>
        </HStack>

        {sortedJobs.length === 0 ? (
          <EmptyStudioArchiveState t={t} theme={theme} />
        ) : (
          sortedJobs.map((job, index) => (
            <StudioArchiveRow
              key={job.jobId}
              job={job}
              expanded={expandedJobId === job.jobId}
              locale={locale}
              onToggle={() => toggleExpanded(job.jobId)}
              t={t}
              zoneLanguage={zoneLanguage}
              index={index}
              {...(job.payment?.paymentId
                ? {
                    onOpenReceipt: () => {
                      router.push(`/receipt/${job.payment!.paymentId}`);
                    },
                  }
                : {})}
            />
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function EmptyStudioArchiveState({
  t,
  theme,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        minHeight: BrandSpacing.xxl * 5,
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.md,
        paddingHorizontal: BrandSpacing.xl,
      }}
    >
      {/* Warm amber accent strip */}
      <View
        style={{
          width: 48,
          height: 3,
          borderRadius: BrandRadius.pill,
          backgroundColor: theme.archive.accent,
          marginBottom: BrandSpacing.sm,
        }}
      />
      <IconSymbol name="archivebox" size={48} color={theme.archive.accent} />
      <ThemedText type="bodyMedium" style={{ color: theme.color.textMuted, textAlign: "center" }}>
        {t("jobsTab.instructorFeed.archiveEmpty")}
      </ThemedText>
      <ThemedText
        type="caption"
        style={{ color: theme.color.textMuted, textAlign: "center", opacity: 0.7 }}
      >
        {t("jobsTab.archive.emptyHint")}
      </ThemedText>
    </View>
  );
}
