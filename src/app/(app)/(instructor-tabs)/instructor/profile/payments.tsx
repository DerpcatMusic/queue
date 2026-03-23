import DateTimePicker from "@react-native-community/datetimepicker";
import { useAction, useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { vars } from "nativewind";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSegmentedToggle, KitStatusBadge, KitSuccessBurst } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useRapydReturn } from "@/contexts/rapyd-return-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBrand } from "@/hooks/use-brand";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";
import { buildRapydBridgeUrl, resolveRapydAppReturnUrl } from "@/lib/rapyd-hosted-flow";

const INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE = "/instructor/profile/identity-verification" as const;
type PayoutPreferenceMode = "immediate_when_eligible" | "scheduled_date" | "manual_hold";

function buildDefaultScheduledDate(timestamp?: number | null) {
  if (timestamp && Number.isFinite(timestamp) && timestamp > Date.now()) {
    return new Date(timestamp);
  }
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  useProfileSubpageSheet({
    title: t("profile.navigation.wallet"),
    routeMatchPath: "/profile/payments",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const isInstructorPaymentsRole = currentUser?.role === "instructor";
  const { consumeReturn: consumeBeneficiaryReturn, latestReturn: latestBeneficiaryReturn } =
    useRapydReturn("beneficiary");

  const paymentRows = useQuery(
    api.payments.listMyPayments,
    isInstructorPaymentsRole ? { limit: 40 } : "skip",
  );
  const payoutSummary = useQuery(
    api.payments.getMyPayoutSummary,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const requestPayoutWithdrawal = useMutation(api.payments.requestMyPayoutWithdrawal);
  const upsertMyPayoutPreference = useMutation(api.payments.upsertMyPayoutPreference);
  const createBeneficiaryOnboardingForInstructor = useAction(
    api.rapyd.createBeneficiaryOnboardingForInstructor,
  );
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [activeOnboardingId, setActiveOnboardingId] =
    useState<Id<"payoutDestinationOnboarding"> | null>(null);
  const [isFinalizingOnboarding, setIsFinalizingOnboarding] = useState(false);
  const [showOnboardingSuccess, setShowOnboardingSuccess] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawInfo, setWithdrawInfo] = useState<string | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceInfo, setPreferenceInfo] = useState<string | null>(null);
  const [pendingPreferenceMode, setPendingPreferenceMode] = useState<PayoutPreferenceMode | null>(
    null,
  );
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<Date>(buildDefaultScheduledDate());
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const selectedPaymentDetail = useQuery(
    api.payments.getMyPaymentDetail,
    selectedPaymentId ? { paymentId: selectedPaymentId } : "skip",
  );
  const activeOnboardingSession = useQuery(
    api.payments.getMyPayoutOnboardingSession,
    activeOnboardingId ? { sessionId: activeOnboardingId } : "skip",
  );

  useEffect(() => {
    if (!isFinalizingOnboarding || !activeOnboardingSession) return;

    if (activeOnboardingSession.status === "completed") {
      setIsFinalizingOnboarding(false);
      setActiveOnboardingId(null);
      setDestinationError(null);
      setDestinationInfo(t("profile.payments.connectSuccess"));
      setShowOnboardingSuccess(true);
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }

    if (
      activeOnboardingSession.status === "failed" ||
      activeOnboardingSession.status === "expired"
    ) {
      setIsFinalizingOnboarding(false);
      setActiveOnboardingId(null);
      setDestinationInfo(null);
      setDestinationError(
        activeOnboardingSession.lastError ??
          (activeOnboardingSession.status === "expired"
            ? t("profile.payments.expired")
            : t("profile.payments.onboardingFailed")),
      );
    }
  }, [activeOnboardingSession, isFinalizingOnboarding, t]);

  useEffect(() => {
    if (!latestBeneficiaryReturn) return;

    consumeBeneficiaryReturn();
    if (latestBeneficiaryReturn.result === "cancel") {
      setActiveOnboardingId(null);
      setIsFinalizingOnboarding(false);
      setDestinationError(null);
      setDestinationInfo(t("profile.payments.cancelled"));
      return;
    }

    setDestinationError(null);
    setDestinationInfo(t("profile.payments.finalizingTitle"));
    setIsFinalizingOnboarding(true);
  }, [consumeBeneficiaryReturn, latestBeneficiaryReturn, t]);

  useEffect(() => {
    if (!isFinalizingOnboarding || activeOnboardingId !== null || !payoutSummary) {
      return;
    }

    if (payoutSummary.hasVerifiedDestination || payoutSummary.onboardingStatus === "completed") {
      setIsFinalizingOnboarding(false);
      setDestinationError(null);
      setDestinationInfo(t("profile.payments.connectSuccess"));
      setShowOnboardingSuccess(true);
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }

    if (
      payoutSummary.onboardingStatus === "failed" ||
      payoutSummary.onboardingStatus === "expired"
    ) {
      setIsFinalizingOnboarding(false);
      setDestinationInfo(null);
      setDestinationError(
        payoutSummary.onboardingLastError ??
          (payoutSummary.onboardingStatus === "expired"
            ? t("profile.payments.expired")
            : t("profile.payments.onboardingFailed")),
      );
    }
  }, [activeOnboardingId, isFinalizingOnboarding, payoutSummary, t]);

  useEffect(() => {
    if (!showOnboardingSuccess) return;
    const timeout = setTimeout(() => {
      setShowOnboardingSuccess(false);
    }, 1600);
    return () => clearTimeout(timeout);
  }, [showOnboardingSuccess]);

  useEffect(() => {
    if (!payoutSummary || pendingPreferenceMode === "scheduled_date") {
      return;
    }
    setScheduleDraft(buildDefaultScheduledDate(payoutSummary.payoutPreferenceScheduledDate));
  }, [payoutSummary, pendingPreferenceMode]);

  if (
    currentUser === undefined ||
    (isInstructorPaymentsRole && paymentRows === undefined) ||
    (currentUser?.role === "instructor" && payoutSummary === undefined) ||
    (activeOnboardingId !== null && activeOnboardingSession === undefined)
  ) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (currentUser.role !== "instructor") {
    return <Redirect href="/" />;
  }

  const rows = paymentRows ?? [];
  const role = currentUser.role as "studio" | "instructor";
  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;
  const isManualPayoutMode = payoutSummary?.payoutReleaseMode !== "automatic";
  const isIdentityVerified = payoutSummary?.isIdentityVerified ?? false;
  const savedPreferenceMode =
    (payoutSummary?.payoutPreferenceMode as PayoutPreferenceMode | undefined) ??
    "immediate_when_eligible";
  const effectivePreferenceMode = pendingPreferenceMode ?? savedPreferenceMode;
  const scheduledAtLabel = formatDateTime(scheduleDraft.getTime(), locale);
  const appReturnUrl = resolveRapydAppReturnUrl("beneficiary");
  const buildBridgeUrl = (result: "complete" | "cancel"): string => {
    return buildRapydBridgeUrl({
      bridgePath: "/rapyd/beneficiary-return-bridge",
      result,
      appReturnUrl,
    });
  };
  const beneficiaryCompleteUrl = buildBridgeUrl("complete");
  const beneficiaryCancelUrl = buildBridgeUrl("cancel");

  const withdrawToBank = async () => {
    setWithdrawBusy(true);
    setWithdrawError(null);
    setWithdrawInfo(null);
    try {
      const result = await requestPayoutWithdrawal({
        maxPayments: 25,
      });
      if (result.scheduledCount === 0) {
        setWithdrawInfo(t("profile.payments.availableBalanceEmpty"));
      } else {
        setWithdrawInfo(
          t("profile.payments.withdrawalStarted", {
            count: result.scheduledCount,
          }),
        );
      }
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : t("profile.payments.withdrawalFailed"),
      );
    } finally {
      setWithdrawBusy(false);
    }
  };

  const confirmWithdrawToBank = () => {
    Alert.alert(
      t("profile.payments.withdrawConfirmTitle"),
      t("profile.payments.withdrawConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.payments.withdrawConfirmAction"),
          style: "default",
          onPress: () => {
            void withdrawToBank();
          },
        },
      ],
    );
  };

  const startHostedBankOnboarding = async () => {
    setOnboardingBusy(true);
    setIsFinalizingOnboarding(false);
    setShowOnboardingSuccess(false);
    setActiveOnboardingId(null);
    setDestinationError(null);
    setDestinationInfo(null);
    try {
      const session = await createBeneficiaryOnboardingForInstructor({
        completeUrl: beneficiaryCompleteUrl,
        cancelUrl: beneficiaryCancelUrl,
      });
      setActiveOnboardingId(session.onboardingId);
      const authResult = await WebBrowser.openAuthSessionAsync(session.redirectUrl, appReturnUrl);
      if (authResult.type === "success") {
        const resultUrl = authResult.url ? new URL(authResult.url) : null;
        const result = resultUrl?.searchParams.get("result") ?? "complete";
        if (result === "cancel") {
          setActiveOnboardingId(null);
          setDestinationInfo(t("profile.payments.cancelled"));
        } else {
          setDestinationInfo(t("profile.payments.finalizingTitle"));
          setIsFinalizingOnboarding(true);
        }
      } else if (authResult.type === "dismiss" || authResult.type === "cancel") {
        setActiveOnboardingId(null);
        setDestinationInfo(t("profile.payments.closed"));
      } else {
        setDestinationInfo(t("profile.payments.opened"));
      }
    } catch (error) {
      setActiveOnboardingId(null);
      setDestinationError(
        error instanceof Error ? error.message : t("profile.payments.openFailed"),
      );
    } finally {
      setOnboardingBusy(false);
    }
  };

  const savePayoutPreference = async (
    preferenceMode: PayoutPreferenceMode,
    scheduledDate?: number,
  ) => {
    setPreferenceBusy(true);
    setPreferenceError(null);
    setPreferenceInfo(null);
    try {
      if (preferenceMode === "scheduled_date") {
        if (!scheduledDate || scheduledDate <= Date.now()) {
          throw new Error(t("profile.payments.preferenceScheduleInvalid"));
        }
      }

      await upsertMyPayoutPreference({
        preferenceMode,
        ...(preferenceMode === "scheduled_date" && scheduledDate ? { scheduledDate } : {}),
      });
      setPendingPreferenceMode(null);
      setPreferenceInfo(
        preferenceMode === "scheduled_date"
          ? t("profile.payments.preferenceSavedScheduled")
          : preferenceMode === "manual_hold"
            ? t("profile.payments.preferenceSavedHold")
            : t("profile.payments.preferenceSavedImmediate"),
      );
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      setPreferenceError(
        error instanceof Error ? error.message : t("profile.payments.preferenceSaveFailed"),
      );
    } finally {
      setPreferenceBusy(false);
    }
  };

  const handlePreferenceModeChange = (mode: PayoutPreferenceMode) => {
    setPreferenceError(null);
    setPreferenceInfo(null);
    if (mode === "scheduled_date") {
      setPendingPreferenceMode(mode);
      setScheduleDraft(buildDefaultScheduledDate(payoutSummary?.payoutPreferenceScheduledDate));
      setShowSchedulePicker(true);
      return;
    }

    setPendingPreferenceMode(null);
    setShowSchedulePicker(false);
    void savePayoutPreference(mode);
  };

  if (isFinalizingOnboarding) {
    return (
      <ProfileSubpageScrollView
        routeKey="instructor/profile/payments"
        className="flex-1"
        style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
        contentContainerClassName="flex-grow justify-center"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          className="items-center border"
          style={vars(
            {
              "--tw-bg-surface-alt": String(palette.surfaceAlt),
              "--tw-border": String(palette.border),
              "--tw-text": String(palette.text),
              gap: BrandSpacing.sm,
              borderRadius: BrandRadius.card,
              padding: BrandSpacing.xl,
            },
          )}
        >
          <ThemedText type="title">{t("profile.payments.finalizingTitle")}</ThemedText>
          <ThemedText
            type="caption"
            className="text-center"
            style={vars({ "--tw-text-muted": String(palette.textMuted) })}
          >
            {t("profile.payments.finalizingBody")}
          </ThemedText>
        </View>
      </ProfileSubpageScrollView>
    );
  }

  if (showOnboardingSuccess) {
    return (
      <ProfileSubpageScrollView
        routeKey="instructor/profile/payments"
        className="flex-1"
        style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
        contentContainerClassName="flex-grow justify-center"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          className="items-center border"
          style={vars(
            {
              "--tw-bg-surface-alt": String(palette.surfaceAlt),
              "--tw-border": String(palette.border),
              gap: BrandSpacing.sm + 2,
              borderRadius: BrandRadius.card,
              padding: BrandSpacing.xl,
            },
          )}
        >
          <KitSuccessBurst iconName="building.columns.fill" />
          <ThemedText type="title">{t("profile.payments.successTitle")}</ThemedText>
          <ThemedText
            type="caption"
            className="text-center"
            style={vars({ "--tw-text-muted": String(palette.textMuted) })}
          >
            {t("profile.payments.successBody")}
          </ThemedText>
        </View>
      </ProfileSubpageScrollView>
    );
  }

  if (showVerifyModal) {
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        className="flex-1"
        style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
      >
        <ProfileSubpageScrollView
          routeKey="instructor/profile/payments"
          className="flex-1"
          style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
          contentContainerClassName="flex-grow justify-center"
          contentContainerStyle={{
            paddingHorizontal: BrandSpacing.lg,
          }}
          bottomSpacing={BrandSpacing.lg}
        >
          <View
            className="items-center border"
            style={vars(
              {
                "--tw-bg-surface-alt": String(palette.surfaceAlt),
                "--tw-border": String(palette.border),
                gap: BrandSpacing.lg,
                borderRadius: BrandRadius.card,
                padding: BrandSpacing.xl,
              },
            )}
          >
            <View
              className="size-20 items-center justify-center rounded-full border-3"
              style={vars(
                {
                  "--tw-bg-primary": String(palette.didit.accent),
                  "--tw-border": String(palette.primarySubtle),
                },
              )}
            >
              <IconSymbol name="person.crop.circle.fill" size={40} color={palette.onPrimary} />
            </View>
            <ThemedText type="title" className="text-center">
              {t("profile.payments.verifyToConnectBankTitle")}
            </ThemedText>
            <ThemedText
              type="caption"
              className="text-center leading-5"
              style={vars({ "--tw-text-muted": String(palette.textMuted) })}
            >
              {t("profile.payments.verifyToConnectBankBody")}
            </ThemedText>
            <View
              className="flex-row items-center rounded-full"
              style={vars({ "--tw-bg-accent-subtle": String(palette.didit.accentSubtle), gap: BrandSpacing.xs, paddingHorizontal: BrandSpacing.md, paddingVertical: BrandSpacing.xs })}
            >
              <ThemedText
                type="micro"
                className="font-semibold"
                style={vars({ "--tw-text-accent": String(palette.didit.accent) })}
              >
                {t("profile.identityVerification.providerPill")}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.verifyToConnectBankCta")}
              onPress={() => {
                setShowVerifyModal(false);
                void router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href);
              }}
              className="w-full border active:opacity-85"
              style={({ pressed }) =>
                vars({
                  "--tw-bg-primary": String(palette.didit.accent),
                  "--tw-text": String(palette.onPrimary),
                  borderRadius: BrandRadius.button,
                  paddingHorizontal: BrandSpacing.lg,
                  paddingVertical: BrandSpacing.md,
                  opacity: pressed ? 0.85 : 1,
                })
              }
            >
              <ThemedText type="bodyStrong" className="text-center" style={vars({ "--tw-text": String(palette.onPrimary) })}>
                {t("profile.payments.verifyToConnectBankCta")}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={() => setShowVerifyModal(false)}
              className="active:opacity-60"
              style={{ paddingHorizontal: BrandSpacing.md, paddingVertical: BrandSpacing.sm + 2 }}
            >
              <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                {t("common.cancel")}
              </ThemedText>
            </Pressable>
          </View>
        </ProfileSubpageScrollView>
      </Animated.View>
    );
  }

  return (
    <ProfileSubpageScrollView
      routeKey="instructor/profile/payments"
      className="flex-1"
      style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
      contentContainerClassName=""
      contentContainerStyle={{ gap: BrandSpacing.xl }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={40}
    >
      <View className="" style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.lg }}>
        {/* Consolidated Error/Info Banner */}
        {destinationError || withdrawError || preferenceError ? (
          <View
            className="border"
            style={vars(
              {
                "--tw-bg-danger-subtle": String(palette.dangerSubtle),
                "--tw-border": String(palette.danger),
                borderRadius: BrandRadius.buttonSubtle,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.sm,
              },
            )}
          >
            <ThemedText type="caption" style={vars({ "--tw-text-danger": String(palette.danger) })}>
              {destinationError || withdrawError || preferenceError}
            </ThemedText>
          </View>
        ) : destinationInfo || withdrawInfo || preferenceInfo ? (
          <View
            className=""
            style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt), borderRadius: BrandRadius.buttonSubtle, paddingHorizontal: BrandSpacing.md, paddingVertical: BrandSpacing.sm })}
          >
            <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
              {destinationInfo || withdrawInfo || preferenceInfo}
            </ThemedText>
          </View>
        ) : null}

        {/* Simplified Status Pill */}
        <KitStatusBadge
          label={
            isIdentityVerified && payoutSummary?.hasVerifiedDestination
              ? t("profile.payments.statusAllSet")
              : isIdentityVerified
                ? t("profile.payments.statusBankNeeded")
                : t("profile.payments.statusVerificationNeeded")
          }
          tone={
            isIdentityVerified && payoutSummary?.hasVerifiedDestination
              ? "success"
              : isIdentityVerified || payoutSummary?.hasVerifiedDestination
                ? "warning"
                : "danger"
          }
          showDot
        />

        {/* Action hint if needed */}
        {!isIdentityVerified ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.setup.verifyIdentity")}
            onPress={() => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href)}
            className="self-start rounded-full border active:bg-surface-alt"
            style={({ pressed }) =>
              vars({
                "--tw-bg-primary-subtle": String(palette.primarySubtle),
                "--tw-border": String(palette.primary),
                "--tw-text-primary": String(palette.primary),
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.sm,
                backgroundColor: pressed ? palette.surfaceAlt : palette.primarySubtle,
              })
            }
          >
            <ThemedText type="caption" style={vars({ "--tw-text-primary": String(palette.primary) })}>
              {t("profile.setup.verifyIdentity")}
            </ThemedText>
          </Pressable>
        ) : !payoutSummary?.hasVerifiedDestination ? (
          <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
            {payoutSummary?.onboardingStatus === "pending"
              ? t("profile.payments.onboardingPending")
              : payoutSummary?.onboardingStatus === "failed"
                ? (payoutSummary?.onboardingLastError ?? t("profile.payments.onboardingFailed"))
                : t("profile.payments.kycRequiredHint")}
          </ThemedText>
        ) : null}
      </View>

      {/* Hero Balance Card */}
      <View style={{ paddingHorizontal: BrandSpacing.md }}>
        <View
          className=""
          style={vars({ "--tw-bg-payments-accent": String(palette.payments.accent), gap: BrandSpacing.xl, borderRadius: BrandRadius.card, padding: BrandSpacing.xl })}
        >
          <View className="flex-row justify-between items-start gap-3">
            <View className="min-w-0 flex-1">
              <ThemedText
                type="caption"
                className="uppercase tracking-wide opacity-80"
                style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
              >
                {t("profile.payments.available")}
              </ThemedText>
              <ThemedText
                numberOfLines={1}
                minimumFontScale={0.76}
                adjustsFontSizeToFit
                className="mt-1 shrink"
                style={vars(
                  {
                    "--tw-text-primary": String(palette.onPrimary),
                    fontSize: BrandType.display.fontSize,
                    lineHeight: BrandType.display.lineHeight,
                    fontWeight: BrandType.display.fontWeight,
                    letterSpacing: BrandType.display.letterSpacing,
                  },
                )}
              >
                {formatAgorotCurrency(
                  payoutSummary?.availableAmountAgorot ?? 0,
                  locale,
                  payoutSummary?.currency ?? "ILS",
                )}
              </ThemedText>
            </View>
            <View
              className="rounded-full"
              style={vars({ "--tw-bg-primary": String(palette.onPrimary), paddingHorizontal: BrandSpacing.md, paddingVertical: BrandSpacing.xs, opacity: 0.2 })}
            >
              <ThemedText type="micro" className="font-bold" style={vars({ "--tw-text-primary": String(palette.onPrimary) })}>
                {payoutSummary?.currency ?? "ILS"}
              </ThemedText>
            </View>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.withdrawToBank")}
              className="flex-1 flex-row items-center justify-center overflow-hidden active:scale-[0.985]"
              style={() => {
                const isDisabled =
                  !isManualPayoutMode ||
                  !isIdentityVerified ||
                  !payoutSummary?.hasVerifiedDestination ||
                  (payoutSummary?.availableAmountAgorot ?? 0) <= 0;
                return vars(
                  {
                    "--tw-bg-primary": String(palette.onPrimary),
                    "--tw-text-primary": String(palette.onPrimary),
                    minHeight: BrandSpacing.xxl + BrandSpacing.xl,
                    gap: BrandSpacing.sm,
                    borderRadius: BrandRadius.button,
                    paddingHorizontal: BrandSpacing.lg,
                    paddingVertical: BrandSpacing.md,
                    opacity: withdrawBusy ? 0.5 : isDisabled ? 0.1 : 0.25,
                  },
                );
              }}
              onPress={() => {
                confirmWithdrawToBank();
              }}
              disabled={
                withdrawBusy ||
                !isManualPayoutMode ||
                !isIdentityVerified ||
                !payoutSummary?.hasVerifiedDestination ||
                (payoutSummary?.availableAmountAgorot ?? 0) <= 0
              }
            >
              <IconSymbol name="arrow.down" size={18} color={palette.onPrimary} />
              <ThemedText type="bodyStrong" style={vars({ "--tw-text-primary": String(palette.onPrimary) })}>
                {t("profile.payments.withdraw")}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")
              }
              className="flex-1 flex-row items-center justify-center border active:scale-[0.985]"
              style={({ pressed }) => {
                const hasDestination = payoutSummary?.hasVerifiedDestination;
                return vars(
                  {
                    "--tw-bg-primary": String(hasDestination ? palette.onPrimary : palette.text),
                    "--tw-border": String(hasDestination ? palette.onPrimary : palette.border),
                    "--tw-text-primary": String(palette.onPrimary),
                    minHeight: BrandSpacing.xxl + BrandSpacing.xl,
                    gap: BrandSpacing.sm,
                    borderRadius: BrandRadius.button,
                    paddingHorizontal: BrandSpacing.lg,
                    paddingVertical: BrandSpacing.md,
                    opacity: hasDestination ? (pressed ? 0.2 : 0.14) : pressed ? 0.88 : 1,
                  },
                );
              }}
              onPress={() => {
                if (!isIdentityVerified) {
                  setShowVerifyModal(true);
                  return;
                }
                void startHostedBankOnboarding();
              }}
              disabled={onboardingBusy}
            >
              <IconSymbol name="building.columns.fill" size={18} color={palette.onPrimary} />
              <ThemedText type="bodyStrong" style={vars({ "--tw-text-primary": String(palette.onPrimary) })}>
                {payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Stats Row - Merged into Hero Card */}
        <View className="flex-row justify-center gap-6">
          <View className="flex-row items-center" style={{ gap: BrandSpacing.xs + 2 }}>
            <View
              className="size-2 rounded-full"
              style={vars({ "--tw-bg-warning": String(palette.warning) })}
            />
            <ThemedText type="caption" className="opacity-70" style={vars({ "--tw-text-primary": String(palette.onPrimary) })}>
              {t("profile.payments.pending")}
            </ThemedText>
            <ThemedText
              type="bodyStrong"
              className="tabular-nums"
              style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
            >
              {formatAgorotCurrency(
                payoutSummary?.pendingAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
          <View className="flex-row items-center" style={{ gap: BrandSpacing.xs + 2 }}>
            <View
              className="size-2 rounded-full"
              style={vars({ "--tw-bg-success": String(palette.success) })}
            />
            <ThemedText type="caption" className="opacity-70" style={vars({ "--tw-text-primary": String(palette.onPrimary) })}>
              {t("profile.payments.paid")}
            </ThemedText>
            <ThemedText
              type="bodyStrong"
              className="tabular-nums"
              style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
            >
              {formatAgorotCurrency(
                payoutSummary?.paidAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={{ gap: BrandSpacing.lg, paddingHorizontal: BrandSpacing.md }}>
        <View className="flex-row justify-between items-center">
          <ThemedText type="bodyStrong">{t("profile.payments.preferenceTitle")}</ThemedText>
        </View>

        <KitSegmentedToggle<PayoutPreferenceMode>
          value={effectivePreferenceMode}
          onChange={handlePreferenceModeChange}
          options={[
            {
              label: t("profile.payments.preferenceImmediate"),
              value: "immediate_when_eligible",
            },
            {
              label: t("profile.payments.preferenceScheduled"),
              value: "scheduled_date",
            },
            {
              label: t("profile.payments.preferenceHold"),
              value: "manual_hold",
            },
          ]}
        />

        <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
          {effectivePreferenceMode === "scheduled_date"
            ? t("profile.payments.preferenceScheduledHint")
            : effectivePreferenceMode === "manual_hold"
              ? t("profile.payments.preferenceHoldHint")
              : t("profile.payments.preferenceImmediateHint")}
        </ThemedText>

        {effectivePreferenceMode === "scheduled_date" ? (
          <View style={{ gap: BrandSpacing.sm + 2 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.preferenceChooseDate")}
              onPress={() => setShowSchedulePicker((value) => !value)}
              className="border active:bg-surface"
              style={({ pressed }) =>
                vars({
                  "--tw-border": String(palette.border),
                  "--tw-bg-app-bg": String(palette.appBg),
                  borderRadius: BrandRadius.buttonSubtle,
                  paddingHorizontal: BrandSpacing.lg,
                  paddingVertical: BrandSpacing.md,
                  backgroundColor: pressed ? palette.surface : palette.appBg,
                })
              }
            >
              <ThemedText type="micro" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                {t("profile.payments.preferenceScheduleAt")}
              </ThemedText>
              <ThemedText type="bodyStrong">{scheduledAtLabel}</ThemedText>
            </Pressable>

            {showSchedulePicker ? (
              <View
                className="border"
                style={vars(
                  {
                    "--tw-border": String(palette.border),
                    "--tw-bg-app-bg": String(palette.appBg),
                    gap: BrandSpacing.sm,
                    borderRadius: BrandRadius.buttonSubtle,
                    paddingHorizontal: BrandSpacing.md,
                    paddingVertical: BrandSpacing.sm,
                  },
                )}
              >
                <DateTimePicker
                  value={scheduleDraft}
                  mode="datetime"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={new Date(Date.now() + 60_000)}
                  onChange={(event, value) => {
                    if (Platform.OS !== "ios") {
                      setShowSchedulePicker(false);
                    }
                    if (event.type === "dismissed" || !value) {
                      return;
                    }
                    setScheduleDraft(value);
                  }}
                />
                {Platform.OS === "ios" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.done")}
                    onPress={() => setShowSchedulePicker(false)}
                    className="self-start rounded-full active:bg-surface"
                    style={({ pressed }) =>
                      vars({
                        "--tw-bg-primary-subtle": String(palette.primarySubtle),
                        paddingHorizontal: BrandSpacing.md,
                        paddingVertical: BrandSpacing.xs + 2,
                        backgroundColor: pressed ? palette.surface : palette.primarySubtle,
                      })
                    }
                  >
                    <ThemedText type="bodyStrong" style={vars({ "--tw-text-primary": String(palette.primary) })}>
                      {t("common.done")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View className="flex-row" style={{ gap: BrandSpacing.sm + 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
                onPress={() => {
                  setPendingPreferenceMode(null);
                  setShowSchedulePicker(false);
                  setScheduleDraft(
                    buildDefaultScheduledDate(payoutSummary?.payoutPreferenceScheduledDate),
                  );
                }}
                className="flex-1 items-center justify-center border active:bg-surface"
                style={({ pressed }) =>
                  vars({
                    "--tw-border": String(palette.border),
                    "--tw-bg-app-bg": String(palette.appBg),
                    minHeight: BrandSpacing.xxl + BrandSpacing.md,
                    borderRadius: BrandRadius.buttonSubtle,
                    backgroundColor: pressed ? palette.surface : palette.appBg,
                  })
                }
              >
                <ThemedText type="bodyStrong">{t("common.cancel")}</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("profile.payments.preferenceSaveSchedule")}
                onPress={() => {
                  void savePayoutPreference("scheduled_date", scheduleDraft.getTime());
                }}
                disabled={preferenceBusy}
                className="flex-1 items-center justify-center active:scale-[0.985]"
                style={({ pressed }) =>
                  vars({
                    "--tw-bg-payments-accent": String(palette.payments.accent),
                    minHeight: BrandSpacing.xxl + BrandSpacing.md,
                    borderRadius: BrandRadius.buttonSubtle,
                    opacity: preferenceBusy ? 0.6 : 1,
                  })
                }
              >
                <ThemedText type="bodyStrong" style={vars({ "--tw-text-primary": String(palette.onPrimary) })}>
                  {preferenceBusy
                    ? t("profile.payments.preferenceSaving")
                    : t("profile.payments.preferenceSaveSchedule")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {preferenceError ? (
          <ThemedText type="caption" style={vars({ "--tw-text-danger": String(palette.danger) })}>
            {preferenceError}
          </ThemedText>
        ) : preferenceInfo ? (
          <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
            {preferenceInfo}
          </ThemedText>
        ) : null}
      </View>

      {selectedPaymentId ? (
        <View style={{ marginTop: BrandSpacing.sm, gap: BrandSpacing.sm + 2, paddingHorizontal: BrandSpacing.md }}>
          <View className="flex-row items-center justify-between">
            <ThemedText type="title">{t("profile.payments.receipt")}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.close")}
              onPress={() => setSelectedPaymentId(null)}
              className="rounded-full active:opacity-84"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt), paddingHorizontal: BrandSpacing.md, paddingVertical: BrandSpacing.xs + 2 })}
            >
              <ThemedText type="caption" className="font-semibold" style={vars({ "--tw-text": String(palette.text) })}>
                {t("profile.payments.close")}
              </ThemedText>
            </Pressable>
          </View>
          {isDetailLoading ? (
            <View
              className="items-center"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt), borderRadius: BrandRadius.card, padding: BrandSpacing.xl })}
            >
              <ThemedText style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                {t("profile.payments.loadingReceipt")}
              </ThemedText>
            </View>
          ) : !selectedPaymentDetail ? (
            <View
              className="items-center"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt), borderRadius: BrandRadius.card, padding: BrandSpacing.xl })}
            >
              <ThemedText style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                {t("profile.payments.paymentNotFound")}
              </ThemedText>
            </View>
          ) : (
            <View
              className="overflow-hidden"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt), borderRadius: BrandRadius.card })}
            >
              <View
                className="items-center border-b border-dashed"
                style={vars({ "--tw-border": String(palette.border), gap: BrandSpacing.sm, padding: BrandSpacing.lg + BrandSpacing.xs })}
              >
                <View
                  className="size-12 items-center justify-center rounded-full mb-1"
                  style={vars({ "--tw-bg-success-subtle": String(palette.successSubtle) })}
                >
                  <IconSymbol
                    name="checkmark"
                    size={24}
                    color={palette.success}
                  />
                </View>
                <ThemedText
                  type="title"
                  className="tabular-nums"
                  style={vars(
                    {
                      "--tw-text": String(palette.text),
                      fontSize: BrandType.heroCompact.fontSize,
                      lineHeight: BrandType.heroCompact.lineHeight,
                      fontWeight: BrandType.heroCompact.fontWeight,
                    },
                  )}
                >
                  {formatAgorotCurrency(
                    role === "studio"
                      ? selectedPaymentDetail.payment.studioChargeAmountAgorot
                      : selectedPaymentDetail.payment.instructorBaseAmountAgorot,
                    locale,
                    selectedPaymentDetail.payment.currency,
                  )}
                </ThemedText>
                <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                  {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                </ThemedText>
              </View>
              <View style={{ gap: BrandSpacing.lg, padding: BrandSpacing.lg + BrandSpacing.xs }}>
                <View className="flex-row justify-between">
                  <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                    {t("profile.payments.status")}
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                  </ThemedText>
                </View>
                <View className="flex-row justify-between">
                  <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                    {t("profile.payments.payout")}
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {selectedPaymentDetail.payout
                      ? getPayoutStatusLabel(selectedPaymentDetail.payout.status)
                      : t("profile.payments.pending")}
                  </ThemedText>
                </View>
                {selectedPaymentDetail.invoice?.externalInvoiceUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.payments.downloadInvoice")}
                    onPress={() => {
                      void WebBrowser.openBrowserAsync(
                        selectedPaymentDetail.invoice!.externalInvoiceUrl!,
                      );
                    }}
                    className="flex-row items-center justify-between active:opacity-84"
                    style={{ paddingVertical: BrandSpacing.sm }}
                  >
                    <ThemedText type="bodyStrong" style={vars({ "--tw-text-primary": String(palette.primary) })}>
                      {t("profile.payments.downloadInvoice")}
                    </ThemedText>
                    <IconSymbol name="arrow.up.right" size={16} color={palette.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>
      ) : null}

      <View className="mt-2">
        <PaymentActivityList
          viewerRole={role}
          items={rows}
          locale={locale}
          palette={palette}
          title={t("profile.payments.recentTransactions")}
          emptyLabel={t("profile.payments.noTransactions")}
          onSelectPaymentId={setSelectedPaymentId}
        />
      </View>
    </ProfileSubpageScrollView>
  );
}
