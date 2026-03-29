import { useAction, useMutation, useQuery } from "convex/react";
import { Redirect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, View } from "react-native";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { LoadingScreen } from "@/components/loading-screen";
import {
  IdentityStatusBadge,
  getIdentityStatusLabel,
} from "@/components/profile/identity-status-ui";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";
import { startDiditNativeVerification } from "@/lib/didit-native";

type BillingProfile = {
  legalEntityType: "individual" | "company";
  status: "incomplete" | "complete";
  legalBusinessName?: string;
  taxId?: string;
  vatReportingType?: "osek_patur" | "osek_murshe" | "company" | "other";
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  completedAt?: number;
};

function getBlockingSummary(
  reasons: string[],
  t: ReturnType<typeof useTranslation>["t"],
) {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "owner_identity_required":
          return t("profile.studioCompliance.blockers.identity");
        case "business_profile_required":
          return t("profile.studioCompliance.blockers.billing");
        case "payment_method_required":
          return t("profile.studioCompliance.blockers.payment");
        default:
          return reason;
      }
    })
    .join(" · ");
}

function getPaymentSubtitle(
  status: "missing" | "pending" | "ready" | "failed",
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (status) {
    case "ready":
      return t("profile.studioCompliance.payment.readyBody");
    case "failed":
      return t("profile.studioCompliance.payment.failedBody");
    case "pending":
      return t("profile.studioCompliance.payment.pendingBody");
    default:
      return t("profile.studioCompliance.payment.missingBody");
  }
}

export default function StudioComplianceScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  useProfileSubpageSheet({
    title: t("profile.navigation.compliance"),
    routeMatchPath: "/profile/compliance",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const shouldLoad = currentUser?.role === "studio";
  const compliance = useQuery(
    api.complianceStudio.getMyStudioComplianceDetails,
    shouldLoad ? {} : "skip",
  );
  const diditVerification = useQuery(
    api.didit.getMyStudioDiditVerification,
    shouldLoad ? {} : "skip",
  );
  const paymentsPreflight = useQuery(
    api.payments.getPaymentsPreflight,
    shouldLoad ? {} : "skip",
  );
  const createStudioDiditSession = useAction(
    api.didit.createSessionForCurrentStudioOwner,
  );
  const refreshStudioDiditVerification = useAction(
    api.didit.refreshMyStudioDiditVerification,
  );
  const saveBillingProfile = useMutation(
    api.complianceStudio.upsertMyStudioBillingProfile,
  );

  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const billingProfile = compliance?.billingProfile as
    | BillingProfile
    | null
    | undefined;
  const [legalEntityType, setLegalEntityType] = useState<
    "individual" | "company"
  >("individual");
  const [vatReportingType, setVatReportingType] = useState<
    "osek_patur" | "osek_murshe" | "company" | "other" | null
  >(null);
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  useEffect(() => {
    if (billingProfile) {
      setLegalEntityType(billingProfile.legalEntityType);
      setVatReportingType(billingProfile.vatReportingType ?? null);
      setLegalBusinessName(billingProfile.legalBusinessName ?? "");
      setTaxId(billingProfile.taxId ?? "");
      setBillingEmail(billingProfile.billingEmail ?? currentUser?.email ?? "");
      setBillingPhone(
        billingProfile.billingPhone ?? currentUser?.phoneE164 ?? "",
      );
      setBillingAddress(billingProfile.billingAddress ?? "");
      return;
    }

    setBillingEmail(currentUser?.email ?? "");
    setBillingPhone(currentUser?.phoneE164 ?? "");
  }, [billingProfile, currentUser?.email, currentUser?.phoneE164]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshStudioDiditVerification({});
    } catch {
      // Keep refresh silent; query will still re-run on next paint if network allows.
    } finally {
      setRefreshing(false);
    }
  }, [refreshStudioDiditVerification]);

  const refreshDiditStatus = useCallback(async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      const latest = await refreshStudioDiditVerification({});
      setFeedback({
        tone: "success",
        message: latest.isVerified
          ? t("profile.studioCompliance.feedback.identityApproved")
          : t("profile.studioCompliance.feedback.identityRefreshStarted"),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : t("profile.studioCompliance.errors.identityStartFailed"),
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshStudioDiditVerification, t]);

  const startDidit = useCallback(async () => {
    setIsStartingDidit(true);
    setFeedback(null);
    try {
      const session = await createStudioDiditSession({});
      const result = await startDiditNativeVerification({
        sessionToken: session.sessionToken,
        locale: i18n.resolvedLanguage ?? "en",
      });
      if (result.outcome !== "cancelled") {
        const latest = await refreshStudioDiditVerification({});
        setFeedback({
          tone: latest.isVerified ? "success" : "success",
          message: latest.isVerified
            ? t("profile.studioCompliance.feedback.identityApproved")
            : t("profile.studioCompliance.feedback.identityRefreshStarted"),
        });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : t("profile.studioCompliance.errors.identityStartFailed"),
      });
    } finally {
      setIsStartingDidit(false);
    }
  }, [
    createStudioDiditSession,
    i18n.resolvedLanguage,
    refreshStudioDiditVerification,
    t,
  ]);

  const saveBilling = useCallback(async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveBillingProfile({
        legalEntityType,
        legalBusinessName,
        taxId,
        billingEmail,
        ...(vatReportingType ? { vatReportingType } : {}),
        ...(billingPhone.trim() ? { billingPhone } : {}),
        ...(billingAddress.trim() ? { billingAddress } : {}),
      });
      setFeedback({
        tone: "success",
        message: t("profile.studioCompliance.feedback.billingSaved"),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : t("profile.studioCompliance.errors.billingSaveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    billingAddress,
    billingEmail,
    billingPhone,
    legalBusinessName,
    legalEntityType,
    saveBillingProfile,
    t,
    taxId,
    vatReportingType,
  ]);

  if (
    currentUser === undefined ||
    (shouldLoad &&
      (compliance === undefined ||
        diditVerification === undefined ||
        paymentsPreflight === undefined))
  ) {
    return <LoadingScreen label={t("profile.studioCompliance.loading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (
    currentUser.role !== "studio" ||
    !compliance ||
    !diditVerification ||
    !paymentsPreflight
  ) {
    return <Redirect href="/" />;
  }

  const blockersSummary = getBlockingSummary(
    compliance.summary.blockingReasons,
    t,
  );
  const paymentStatus =
    paymentsPreflight.readyForCheckout &&
    compliance.summary.paymentStatus === "ready"
      ? "ready"
      : compliance.summary.paymentStatus;
  const paymentSubtitle =
    paymentStatus !== "ready" &&
    compliance.summary.paymentReadinessSource === "legacy_env"
      ? t("onboarding.verification.studioPaymentGroundwork")
      : getPaymentSubtitle(paymentStatus, t);

  return (
    <ProfileSubpageScrollView
      routeKey="studio/profile/compliance"
      style={{ flex: 1, backgroundColor: theme.color.appBg }}
      contentContainerStyle={{ gap: BrandSpacing.xl }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.xxl}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshAll()}
        />
      }
    >
      <View
        style={{ paddingHorizontal: BrandSpacing.inset, gap: BrandSpacing.xl }}
      >
        {feedback ? (
          <NoticeBanner
            tone={feedback.tone}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        <View style={{ gap: BrandSpacing.sm }}>
          <ThemedText selectable style={BrandType.title}>
            {compliance.summary.canPublishJobs
              ? t("profile.studioCompliance.hero.readyTitle")
              : t("profile.studioCompliance.hero.blockedTitle")}
          </ThemedText>
          <ThemedText
            selectable
            type="caption"
            style={{ color: theme.color.textMuted }}
          >
            {compliance.summary.canPublishJobs
              ? t("profile.studioCompliance.hero.readyBody")
              : t("profile.studioCompliance.hero.blockedBody", {
                  blockers: blockersSummary,
                })}
          </ThemedText>
        </View>

        <View>
          <ProfileSectionHeader
            label={t("profile.studioCompliance.sections.identity")}
            description={t(
              "profile.studioCompliance.sections.identityDescription",
            )}
            icon="person.text.rectangle.fill"
          />
          <ProfileSectionCard style={{ marginHorizontal: 0 }}>
            <View style={{ gap: BrandSpacing.md, padding: BrandSpacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: BrandSpacing.sm,
                }}
              >
                <ThemedText type="defaultSemiBold">
                  {t("profile.studioCompliance.identity.title")}
                </ThemedText>
                <IdentityStatusBadge status={diditVerification.status} />
              </View>
              <ThemedText style={{ color: theme.color.textMuted }}>
                {diditVerification.isVerified
                  ? t("profile.studioCompliance.identity.approvedBody", {
                      legalName:
                        diditVerification.legalName ??
                        currentUser.fullName ??
                        t("profile.account.fallbackName"),
                    })
                  : t("profile.studioCompliance.identity.requiredBody", {
                      status: getIdentityStatusLabel(diditVerification.status),
                    })}
              </ThemedText>
              <ActionButton
                label={
                  diditVerification.isVerified
                    ? t("profile.studioCompliance.actions.refreshIdentity")
                    : t("profile.studioCompliance.actions.startIdentity")
                }
                fullWidth
                loading={isStartingDidit || refreshing}
                disabled={isStartingDidit || refreshing}
                onPress={() => {
                  if (diditVerification.isVerified) {
                    void refreshDiditStatus();
                    return;
                  }
                  void startDidit();
                }}
              />
            </View>
          </ProfileSectionCard>
        </View>

        <View>
          <ProfileSectionHeader
            label={t("profile.studioCompliance.sections.billing")}
            description={t(
              "profile.studioCompliance.sections.billingDescription",
            )}
            icon="doc.text.fill"
          />
          <ProfileSectionCard style={{ marginHorizontal: 0 }}>
            <View style={{ gap: BrandSpacing.md, padding: BrandSpacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: BrandSpacing.sm,
                }}
              >
                <ChoicePill
                  label={t("profile.studioCompliance.billing.entityIndividual")}
                  selected={legalEntityType === "individual"}
                  onPress={() => setLegalEntityType("individual")}
                  backgroundColor={theme.color.surface}
                  selectedBackgroundColor={theme.color.primary}
                  labelColor={theme.color.text}
                  selectedLabelColor={theme.color.onPrimary}
                />
                <ChoicePill
                  label={t("profile.studioCompliance.billing.entityCompany")}
                  selected={legalEntityType === "company"}
                  onPress={() => setLegalEntityType("company")}
                  backgroundColor={theme.color.surface}
                  selectedBackgroundColor={theme.color.primary}
                  labelColor={theme.color.text}
                  selectedLabelColor={theme.color.onPrimary}
                />
              </View>

              <KitTextField
                label={t("profile.studioCompliance.billing.legalBusinessName")}
                value={legalBusinessName}
                onChangeText={setLegalBusinessName}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.taxId")}
                value={taxId}
                onChangeText={setTaxId}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.billingEmail")}
                value={billingEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setBillingEmail}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.billingPhone")}
                value={billingPhone}
                keyboardType="phone-pad"
                onChangeText={setBillingPhone}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.billingAddress")}
                value={billingAddress}
                onChangeText={setBillingAddress}
              />

              <View style={{ gap: BrandSpacing.xs }}>
                <ThemedText
                  type="caption"
                  style={{ color: theme.color.textMuted }}
                >
                  {t("profile.studioCompliance.billing.vatReportingType")}
                </ThemedText>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: BrandSpacing.sm,
                  }}
                >
                  {(
                    ["osek_patur", "osek_murshe", "company", "other"] as const
                  ).map((value) => (
                    <ChoicePill
                      key={value}
                      label={t(
                        `profile.studioCompliance.billing.vatOptions.${value}` as const,
                      )}
                      selected={vatReportingType === value}
                      onPress={() => setVatReportingType(value)}
                      backgroundColor={theme.color.surface}
                      selectedBackgroundColor={theme.color.primary}
                      labelColor={theme.color.text}
                      selectedLabelColor={theme.color.onPrimary}
                    />
                  ))}
                </View>
              </View>

              <ActionButton
                label={t("profile.studioCompliance.actions.saveBilling")}
                fullWidth
                loading={isSaving}
                disabled={isSaving}
                onPress={() => {
                  void saveBilling();
                }}
              />
            </View>
          </ProfileSectionCard>
        </View>

        <View>
          <ProfileSectionHeader
            label={t("profile.studioCompliance.sections.payment")}
            description={t(
              "profile.studioCompliance.sections.paymentDescription",
            )}
            icon="creditcard.fill"
          />
          <ProfileSectionCard style={{ marginHorizontal: 0 }}>
            <ProfileSettingRow
              title={t("profile.studioCompliance.payment.title")}
              subtitle={paymentSubtitle}
              value={
                paymentStatus === "ready"
                  ? t("profile.compliance.values.approved")
                  : t("profile.compliance.values.actionRequired")
              }
              icon="creditcard.fill"
              onPress={() => router.push("/studio/profile/payments" as Href)}
            />
          </ProfileSectionCard>
        </View>
      </View>
    </ProfileSubpageScrollView>
  );
}
