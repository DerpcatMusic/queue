import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import type React from "react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { formatTime, getBoostPresentation } from "@/lib/jobs-utils";
import { Box, HStack, Text, VStack } from "@/primitives";
import type { StudioJob } from "./studio-jobs-list.types";

type StudioJobDetailSheetProps = {
  innerRef: React.RefObject<BottomSheet>;
  job: StudioJob | null;
  locale: string;
  zoneLanguage: "en" | "he";
  onDismiss: () => void;
  onReview: (applicationId: string, status: "accepted" | "rejected") => void;
  reviewingApplicationId: string | null;
  onInstructorPress?: ((instructorId: Id<"instructorProfiles">) => void) | undefined;
};

export function StudioJobDetailSheet({
  innerRef,
  job,
  locale,
  zoneLanguage,
  onDismiss,
  onReview,
  reviewingApplicationId,
  onInstructorPress,
}: StudioJobDetailSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const snapPoints = ["85%"];

  const boost = useMemo(
    () =>
      job
        ? getBoostPresentation(job.pay, job.boostPreset, job.boostBonusAmount, job.boostActive)
        : null,
    [job],
  );

  const zoneLabel = useMemo(
    () => (job ? getZoneLabel(job.zone, zoneLanguage) : ""),
    [job, zoneLanguage],
  );

  const pendingApplications = useMemo(
    () => (job ? job.applications.filter((a) => a.status === "pending") : []),
    [job],
  );

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

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onClose={onDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.color.borderStrong }}
      backgroundStyle={{ backgroundColor: theme.color.surface }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {job ? (
          <>
            {/* Header */}
            <HStack gap="md" justify="between" align="start" style={styles.header}>
              <VStack gap="xxs">
                <Text variant="title">{toSportLabel(job.sport as never)}</Text>
                <Text variant="caption" color="textMuted">
                  {zoneLabel}
                </Text>
              </VStack>
              <Pressable
                onPress={() => innerRef.current?.close()}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: pressed
                      ? theme.color.surfaceElevated
                      : theme.color.surfaceMuted,
                  },
                ]}
              >
                <AppSymbol name="xmark" size={18} tintColor={theme.color.textMuted} />
              </Pressable>
            </HStack>

            {/* Time + Pay Row */}
            <HStack gap="lg" align="center">
              <HStack gap="xs" align="center">
                <Icon name="clock" size={14} color="textMuted" />
                <Text variant="body" color="textMuted">
                  {formatTime(job.startTime, locale)} — {formatTime(job.endTime, locale)}
                </Text>
              </HStack>
              <HStack gap="xs" align="center">
                <Text variant="title" color="primary">
                  ₪{boost?.totalPay ?? job.pay}
                </Text>
                {boost?.badgeKey && (
                  <Box
                    backgroundColor="primarySubtle"
                    style={{ borderRadius: BrandRadius.pill }}
                    px="xs"
                    py="xs"
                  >
                    <HStack gap="stackHair" align="center">
                      <Icon name="sparkles" size={10} color="primary" />
                      <Text variant="micro" color="primary">
                        +₪{job.boostBonusAmount ?? 20}
                      </Text>
                    </HStack>
                  </Box>
                )}
              </HStack>
            </HStack>

            {/* Pending Applications */}
            {pendingApplications.length > 0 && (
              <VStack gap="sm" style={styles.section}>
                <HStack justify="between" align="center">
                  <Text variant="bodyStrong">{t("jobsTab.card.reviewQueue")}</Text>
                  <Box
                    backgroundColor="surfaceMuted"
                    style={{ borderRadius: BrandRadius.pill }}
                    px="xs"
                    py="xs"
                  >
                    <Text variant="micro" color="textMuted">
                      {pendingApplications.length}
                    </Text>
                  </Box>
                </HStack>

                <VStack gap="sm">
                  {pendingApplications.map((application) => {
                    const isReviewing = reviewingApplicationId === application.applicationId;
                    const initials = application.instructorName
                      .split(" ")
                      .map((p) => p.trim()[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <Box
                        key={application.applicationId}
                        backgroundColor="surfaceElevated"
                        style={[
                          {
                            borderRadius: BrandRadius.medium,
                            borderWidth: BorderWidth.thin,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <HStack gap="md">
                          {/* Avatar on LEFT - rectangular, flush with card */}
                          <View
                            style={[
                              styles.avatarRect,
                              { backgroundColor: theme.color.primarySubtle },
                            ]}
                          >
                            {application.profileImageUrl ? (
                              <Image
                                source={{ uri: application.profileImageUrl }}
                                style={styles.avatarImage}
                                contentFit="cover"
                              />
                            ) : (
                              <Text variant="title" color="primary">
                                {initials}
                              </Text>
                            )}
                          </View>

                          {/* Right side: name + buttons stacked */}
                          <Box style={{ flex: 1, justifyContent: "center" }} p="md">
                            <VStack gap="md">
                              {/* Name */}
                              <Pressable
                                disabled={!onInstructorPress}
                                onPress={() => onInstructorPress?.(application.instructorId)}
                                style={({ pressed }) => ({
                                  opacity: pressed && onInstructorPress ? 0.82 : 1,
                                })}
                              >
                                <Text
                                  variant="title"
                                  style={{
                                    color: onInstructorPress
                                      ? theme.color.primary
                                      : theme.color.text,
                                  }}
                                >
                                  {application.instructorName}
                                </Text>
                              </Pressable>

                              {/* Buttons below name - reject LEFT, accept RIGHT */}
                              <HStack gap="sm">
                                <ActionButton
                                  label={
                                    isReviewing
                                      ? t("jobsTab.actions.rejecting")
                                      : t("jobsTab.actions.reject")
                                  }
                                  onPress={() => onReview(application.applicationId, "rejected")}
                                  tone="secondary"
                                  disabled={isReviewing}
                                  colors={{
                                    backgroundColor: theme.color.danger,
                                    labelColor: theme.color.onPrimary,
                                    pressedBackgroundColor: theme.color.dangerSubtle,
                                    disabledBackgroundColor: theme.color.surfaceMuted,
                                    disabledLabelColor: theme.color.textMuted,
                                  }}
                                />
                                <ActionButton
                                  label={
                                    isReviewing
                                      ? t("jobsTab.actions.accepting")
                                      : t("jobsTab.actions.accept")
                                  }
                                  onPress={() => onReview(application.applicationId, "accepted")}
                                  loading={isReviewing}
                                />
                              </HStack>
                            </VStack>
                          </Box>
                        </HStack>

                        {/* Message at bottom if exists */}
                        {application.message && (
                          <Box
                            backgroundColor="surfaceMuted"
                            p="md"
                            style={{
                              borderTopWidth: BorderWidth.thin,
                              borderTopColor: theme.color.border,
                            }}
                          >
                            <Text variant="caption" color="textMuted" numberOfLines={2}>
                              {application.message}
                            </Text>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </VStack>
              </VStack>
            )}
          </>
        ) : (
          /* Empty state when no job is selected - but sheet is mounted */
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: BrandSpacing.xxl,
            }}
          >
            <Text variant="body" color="textMuted">
              Select a job to view details
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: BrandSpacing.lg,
  },
  header: {
    marginBottom: BrandSpacing.lg,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BrandRadius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: BrandSpacing.lg,
  },
  avatarRect: {
    width: 80,
    height: "100%",
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
});

import { Icon } from "@/primitives";
