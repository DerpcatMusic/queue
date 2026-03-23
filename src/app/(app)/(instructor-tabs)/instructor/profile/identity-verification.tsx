import { useAction, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as ExpoLinking from "expo-linking";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NativeModules, Platform, Pressable, RefreshControl, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { LoadingScreen } from "@/components/loading-screen";
import {
  getIdentityStatusLabel,
  IdentityStatusBadge,
} from "@/components/profile/identity-status-ui";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSuccessBurst } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type DiditSdkResult = {
  type?: "completed" | "cancelled" | "failed";
  error?: { message?: string };
  session?: { status?: string };
};

type DiditSdkModule = {
  startVerification: (
    sessionToken: string,
    config?: {
      languageCode?: string;
      loggingEnabled?: boolean;
    },
  ) => Promise<DiditSdkResult>;
};

let cachedDiditSdkModule: DiditSdkModule | null | undefined;

const PROCESSING_STATUSES = new Set(["in_progress", "pending", "in_review"]);
const ACTIVE_REVIEW_STATUSES = new Set(["pending", "in_review"]);
const DIDIT_DOCS_URL = "https://docs.didit.me/integration/native-sdks/react-native-sdk";
const ISRAEL_SAFER_PAYMENTS_URL =
  "https://www.boi.org.il/en/communication-and-publications/press-releases/safer-payments-principles-for-implementing-stronger-customer-authentication-in-the-payment-cards-market/";
const ISRAEL_AML_ORDER_URL =
  "https://www.gov.il/BlobFolder/dynamiccollectorresultitem/service-providers-prevention-ml-english/he/legal-docs_service_providers_prevention_ml_english.pdf";

const resolveDiditSdkModule = async (): Promise<DiditSdkModule | null> => {
  if (cachedDiditSdkModule !== undefined) {
    return cachedDiditSdkModule;
  }

  if (Platform.OS === "web" || Constants.appOwnership === "expo") {
    cachedDiditSdkModule = null;
    return cachedDiditSdkModule;
  }

  const nativeDiditModule =
    typeof NativeModules === "object" && NativeModules !== null
      ? (NativeModules as Record<string, unknown>).SdkReactNative
      : undefined;
  const turboModuleProxy = (
    global as typeof global & { __turboModuleProxy?: (name: string) => unknown }
  ).__turboModuleProxy;
  const turboDiditModule =
    typeof turboModuleProxy === "function" ? turboModuleProxy("SdkReactNative") : undefined;

  if (!nativeDiditModule && !turboDiditModule) {
    cachedDiditSdkModule = null;
    return cachedDiditSdkModule;
  }

  try {
    cachedDiditSdkModule = (await import("@didit-protocol/sdk-react-native")) as DiditSdkModule;
    return cachedDiditSdkModule;
  } catch {
    cachedDiditSdkModule = null;
    return cachedDiditSdkModule;
  }
};

function isProcessingStatus(status: string) {
  return PROCESSING_STATUSES.has(status);
}

function isActiveReviewStatus(status: string) {
  return ACTIVE_REVIEW_STATUSES.has(status);
}

function getStatusHeadline(status: string, t: ReturnType<typeof useTranslation>["t"]) {
  switch (status) {
    case "approved":
      return t("profile.identityVerification.headline.approved");
    case "declined":
      return t("profile.identityVerification.headline.declined");
    case "in_review":
      return t("profile.identityVerification.headline.in_review");
    case "pending":
      return t("profile.identityVerification.headline.pending");
    case "in_progress":
      return t("profile.identityVerification.headline.in_progress");
    case "abandoned":
      return t("profile.identityVerification.headline.abandoned");
    case "expired":
      return t("profile.identityVerification.headline.expired");
    default:
      return t("profile.identityVerification.headline.default");
  }
}

function getStatusBody(status: string, t: ReturnType<typeof useTranslation>["t"]) {
  switch (status) {
    case "approved":
      return t("profile.identityVerification.body.approved");
    case "declined":
      return t("profile.identityVerification.body.declined");
    case "in_review":
      return t("profile.identityVerification.body.in_review");
    case "pending":
      return t("profile.identityVerification.body.pending");
    case "in_progress":
      return t("profile.identityVerification.body.in_progress");
    case "abandoned":
      return t("profile.identityVerification.body.abandoned");
    case "expired":
      return t("profile.identityVerification.body.expired");
    default:
      return t("profile.identityVerification.body.default");
  }
}

function formatDateTime(value: number | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

function LinkPill({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BrandSpacing.xs,
        }}
      >
        <ThemedText type="caption" style={{ color }}>
          {label}
        </ThemedText>
        <IconSymbol name="arrow.up.right" size={14} color={color} />
      </View>
    </Pressable>
  );
}

function LoaderDot({ delay, color }: { delay: number; color: string }) {
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 420 }), withTiming(0.45, { duration: 420 })),
        -1,
        false,
      ),
    );
  }, [delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.35 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: BrandSpacing.sm,
          height: BrandSpacing.sm,
          borderRadius: BrandRadius.pill,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

function VerificationResolvingState({ label }: { label: string }) {
  const { t } = useTranslation();
  const palette = useBrand();
  const halo = useSharedValue(0.8);
  const settle = useSharedValue(0);
  const cardFloat = useSharedValue(0);
  const bubbleFloat = useSharedValue(0);

  useEffect(() => {
    settle.value = withTiming(1, { duration: 320 });
    halo.value = withRepeat(
      withSequence(withTiming(1.18, { duration: 850 }), withTiming(0.8, { duration: 850 })),
      -1,
      false,
    );
    cardFloat.value = withRepeat(
      withSequence(withTiming(-5, { duration: 1200 }), withTiming(0, { duration: 1200 })),
      -1,
      false,
    );
    bubbleFloat.value = withRepeat(
      withSequence(withTiming(-10, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
      false,
    );
  }, [bubbleFloat, cardFloat, halo, settle]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + halo.value * 0.18,
    transform: [{ scale: halo.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + settle.value * 0.28,
    transform: [{ translateY: cardFloat.value }, { scale: 0.96 + settle.value * 0.04 }],
  }));

  const bubbleLeftStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + settle.value * 0.1,
    transform: [{ translateY: bubbleFloat.value }, { scale: 0.92 + settle.value * 0.08 }],
  }));

  const bubbleRightStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + settle.value * 0.1,
    transform: [{ translateY: bubbleFloat.value * -0.7 }, { scale: 0.9 + settle.value * 0.1 }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: BrandSpacing.xl,
        backgroundColor: palette.appBg,
      }}
    >
      <Animated.View
        entering={FadeInDown.springify().damping(16).stiffness(170)}
        style={{
          width: "100%",
          maxWidth: 340,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: BrandSpacing.xl,
              left: BrandSpacing.lg,
              width: BrandSpacing.sm,
              height: BrandSpacing.sm,
              borderRadius: BrandRadius.pill,
              backgroundColor: palette.primarySubtle as string,
            },
            bubbleLeftStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              right: BrandSpacing.xl,
              bottom: BrandSpacing.lg,
              width: BrandSpacing.sm,
              height: BrandSpacing.sm,
              borderRadius: BrandRadius.pill,
              backgroundColor: palette.primarySubtle as string,
            },
            bubbleRightStyle,
          ]}
        />

        <Animated.View
          style={[
            {
              gap: BrandSpacing.md,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: BrandSpacing.lg,
              paddingHorizontal: BrandSpacing.lg,
              borderRadius: BrandRadius.card,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: palette.border as string,
              backgroundColor: palette.surfaceAlt as string,
              overflow: "hidden",
            },
            cardStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                width: BrandSpacing.haloSize,
                height: BrandSpacing.haloSize,
                borderRadius: BrandRadius.circle,
                backgroundColor: palette.primarySubtle as string,
              },
              haloStyle,
            ]}
          />

          <Animated.View
            entering={FadeInDown.delay(90).duration(280)}
            style={{
              width: BrandSpacing.iconContainerLarge,
              height: BrandSpacing.iconContainerLarge,
              borderRadius: BrandRadius.circle,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: palette.borderStrong as string,
              backgroundColor: palette.surface as string,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
              <LoaderDot delay={0} color={palette.primary as string} />
              <LoaderDot delay={140} color={palette.primary as string} />
              <LoaderDot delay={280} color={palette.primary as string} />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(150).duration(320)}
            style={{ gap: BrandSpacing.sm, alignItems: "center" }}
          >
            <ThemedText type="title" style={{ textAlign: "center" }}>
              {t("profile.identityVerification.resolvingTitle")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted, textAlign: "center" }}>
              {label}
            </ThemedText>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

export default function IdentityVerificationScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  const currentUser = useQuery(api.users.getCurrentUser);
  const diditVerification = useQuery(
    api.didit.getMyDiditVerification,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const createSessionForCurrentInstructor = useAction(api.didit.createSessionForCurrentInstructor);
  const refreshMyDiditVerification = useAction(api.didit.refreshMyDiditVerification);

  const diditReturnUrl = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        native: "queue://didit/return",
        scheme: "queue",
        path: "didit/return",
      }),
    [],
  );

  const [busy, setBusy] = useState(false);
  const [awaitingFinalResult, setAwaitingFinalResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [showApprovalBurst, setShowApprovalBurst] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousStatusRef = useRef<string | null>(null);

  const status = localStatus ?? diditVerification?.status ?? "not_started";
  const isVerified = diditVerification?.isVerified ?? false;
  const needsStatusCheck = isActiveReviewStatus(status);
  const legalName = diditVerification?.legalName ?? null;
  const verifiedAtLabel = formatDateTime(diditVerification?.verifiedAt);
  const lastEventAtLabel = formatDateTime(diditVerification?.lastEventAt);
  const isInProgressState =
    status === "in_progress" || status === "pending" || status === "in_review";
  const diditStatusBackground = resolvedScheme === "dark" ? palette.accentDark : palette.accentLight;
  const diditSectionBackground = resolvedScheme === "dark" ? palette.accentRowBgDark : palette.accentRowBgLight;
  const diditPressedBlue = palette.didit.accent;
  const openExternalUrl = useCallback(
    (url: string) => {
      void ExpoLinking.openURL(url).catch(() => {
        setErrorMessage(t("profile.identityVerification.externalLinkFailed"));
      });
    },
    [t],
  );
  const refreshVerificationStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const latest = await refreshMyDiditVerification({});
      setLocalStatus(latest.status);
      setErrorMessage(null);
      setInfoMessage(
        t("profile.identityVerification.lastUpdate", {
          date: formatDateTime(Date.now()) ?? "",
        }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("profile.identityVerification.confirmFailed"),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMyDiditVerification, t]);
  const refreshAccessory = useMemo(
    () => (
      <IconButton
        size={40}
        tone="primarySubtle"
        backgroundColorOverride={String(palette.primarySubtle) + "CC"}
        accessibilityLabel={t("profile.identityVerification.refreshStatus")}
        disabled={busy || isRefreshing}
        onPress={() => {
          void refreshVerificationStatus();
        }}
        icon={<IconSymbol name="arrow.clockwise" size={18} color={palette.onPrimary as string} />}
      />
    ),
    [busy, isRefreshing, palette.onPrimary, palette.primarySubtle, refreshVerificationStatus, t],
  );
  useProfileSubpageSheet({
    title: t("profile.navigation.identityVerification"),
    routeMatchPath: "/profile/identity-verification",
    rightAccessory: refreshAccessory,
  });

  useEffect(() => {
    if (previousStatusRef.current === null) {
      previousStatusRef.current = status;
      return;
    }
    if (status === "approved" && previousStatusRef.current !== "approved") {
      setShowApprovalBurst(true);
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    previousStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!showApprovalBurst) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setShowApprovalBurst(false);
    }, 2200);
    return () => clearTimeout(timeoutId);
  }, [showApprovalBurst]);

  useEffect(() => {
    if (!awaitingFinalResult || currentUser?.role !== "instructor") {
      return;
    }

    const MAX_PROCESSING_POLL_ATTEMPTS = 120;
    const MAX_ERROR_POLL_ATTEMPTS = 20;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let processingPollAttempts = 0;
    let errorPollAttempts = 0;

    const poll = async () => {
      try {
        const latest = await refreshMyDiditVerification({});
        if (cancelled) {
          return;
        }

        setLocalStatus(latest.status);

        if (isProcessingStatus(latest.status)) {
          processingPollAttempts += 1;
          if (processingPollAttempts >= MAX_PROCESSING_POLL_ATTEMPTS) {
            setAwaitingFinalResult(false);
            setErrorMessage(t("profile.identityVerification.slow"));
            setInfoMessage(null);
            return;
          }
          timeoutId = setTimeout(() => {
            void poll();
          }, 1500);
          return;
        }

        setAwaitingFinalResult(false);
        if (latest.status === "approved") {
          setInfoMessage(t("profile.identityVerification.approvedInfo"));
          setErrorMessage(null);
        } else if (latest.status === "declined") {
          setErrorMessage(t("profile.identityVerification.declinedInfo"));
          setInfoMessage(null);
        } else {
          setInfoMessage(
            t("profile.identityVerification.finishedWithStatus", {
              status: getIdentityStatusLabel(latest.status),
            }),
          );
          setErrorMessage(null);
        }
      } catch {
        if (cancelled) {
          return;
        }
        errorPollAttempts += 1;
        if (errorPollAttempts >= MAX_ERROR_POLL_ATTEMPTS) {
          setAwaitingFinalResult(false);
          setErrorMessage(t("profile.identityVerification.confirmFailed"));
          setInfoMessage(null);
          return;
        }
        timeoutId = setTimeout(() => {
          void poll();
        }, 1800);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [awaitingFinalResult, currentUser?.role, refreshMyDiditVerification, t]);

  if (
    currentUser === undefined ||
    (currentUser?.role === "instructor" && diditVerification === undefined)
  ) {
    return <LoadingScreen label={t("profile.identityVerification.loadingStatus")} />;
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

  const beginAwaitingFinalResult = (nextStatus: string) => {
    setLocalStatus(nextStatus);
    setInfoMessage(null);
    setErrorMessage(null);
    setAwaitingFinalResult(true);
  };

  const startVerification = async () => {
    if (busy || awaitingFinalResult || isVerified || needsStatusCheck) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const sdk = await resolveDiditSdkModule();

      if (!sdk) {
        if (Platform.OS === "web") {
          const session = await createSessionForCurrentInstructor({
            callback: diditReturnUrl,
          });
          const browserResult = await WebBrowser.openAuthSessionAsync(
            session.verificationUrl,
            diditReturnUrl,
          );

          if (browserResult.type === "success") {
            beginAwaitingFinalResult("in_review");
          } else if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
            setInfoMessage(t("profile.identityVerification.cancelled"));
          } else {
            setErrorMessage(t("profile.identityVerification.invalidReturn"));
          }
          return;
        }

        setErrorMessage(t("profile.identityVerification.nativeUnavailable"));
        return;
      }

      const session = await createSessionForCurrentInstructor({});

      const result = await sdk.startVerification(session.sessionToken, {
        languageCode: i18n.resolvedLanguage ?? i18n.language ?? undefined,
        loggingEnabled: __DEV__,
      });
      if (result.type === "completed") {
        beginAwaitingFinalResult("in_review");
      } else if (result.type === "cancelled") {
        setInfoMessage(t("profile.identityVerification.cancelled"));
      } else {
        setErrorMessage(result.error?.message ?? t("profile.identityVerification.startFailed"));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("profile.identityVerification.startFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryAction = () => {
    if (needsStatusCheck) {
      void refreshVerificationStatus();
      return;
    }
    void startVerification();
  };

  const primaryActionLabel = busy
    ? t("profile.identityVerification.starting")
    : needsStatusCheck
      ? t("profile.identityVerification.checkStatus")
      : t("profile.identityVerification.start");

  if (awaitingFinalResult) {
    return <VerificationResolvingState label={t("profile.identityVerification.resolvingLabel")} />;
  }

  return (
    <ProfileSubpageScrollView
      routeKey="instructor/profile/identity-verification"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{
        gap: BrandSpacing.xl,
      }}
      topSpacing={16}
      bottomSpacing={44}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void refreshVerificationStatus();
          }}
          tintColor={palette.didit.accent}
        />
      }
    >
      <View style={{ paddingHorizontal: BrandSpacing.md, gap: BrandSpacing.md }}>
        {showApprovalBurst ? <KitSuccessBurst /> : null}

        <View
          style={{
            gap: BrandSpacing.lg,
            padding: BrandSpacing.md,
            borderRadius: BrandRadius.card,
            borderCurve: "continuous",
            backgroundColor: isInProgressState ? diditStatusBackground : (palette.surface as string),
            paddingBottom: BrandSpacing.md,
          }}
        >
          <View style={{ gap: BrandSpacing.sm }}>
            <ThemedText type="micro" style={{ color: palette.textMuted }}>
              {t("profile.identityVerification.eyebrow")}
            </ThemedText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: BrandSpacing.sm,
              }}
            >
              <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                <ThemedText type="title" style={{ letterSpacing: BrandType.title.letterSpacing }}>
                  {getStatusHeadline(status, t)}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: palette.textMuted, maxWidth: 520 }}
                >
                  {getStatusBody(status, t)}
                </ThemedText>
              </View>
              <IdentityStatusBadge status={status} palette={palette} />
            </View>
          </View>

          {legalName ? (
            <View
              style={{
                gap: BrandSpacing.xs,
              }}
            >
              <ThemedText type="micro" style={{ color: palette.textMuted }}>
                {t("profile.identityVerification.verifiedLegalName")}
              </ThemedText>
              <ThemedText type="bodyStrong">{legalName}</ThemedText>
            </View>
          ) : null}

          {verifiedAtLabel || lastEventAtLabel ? (
            <View style={{ gap: BrandSpacing.xs }}>
              {verifiedAtLabel ? (
                <ThemedText type="caption" style={{ color: palette.textMuted }}>
                  {t("profile.identityVerification.verifiedAt", {
                    date: verifiedAtLabel,
                  })}
                </ThemedText>
              ) : null}
              {lastEventAtLabel ? (
                <ThemedText type="caption" style={{ color: palette.textMuted }}>
                  {t("profile.identityVerification.lastUpdate", {
                    date: lastEventAtLabel,
                  })}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>

        {!isVerified ? (
          <Pressable
            onPress={() => {
              handlePrimaryAction();
            }}
            disabled={busy || isRefreshing}
            style={({ pressed }) => ({
              borderRadius: BrandRadius.button,
              borderCurve: "continuous",
              alignItems: "center",
              paddingVertical: BrandSpacing.md,
              paddingHorizontal: BrandSpacing.md,
              borderWidth: 1,
              borderColor: busy || isRefreshing ? (palette.borderStrong as string) : palette.didit.accent,
              backgroundColor: busy || isRefreshing
                ? (palette.surfaceAlt as string)
                : pressed
                  ? diditPressedBlue
                  : palette.didit.accent,
              opacity: busy || isRefreshing ? 0.7 : 1,
            })}
          >
            <ThemedText type="bodyStrong" style={{ color: palette.onPrimary as string }}>
              {primaryActionLabel}
            </ThemedText>
          </Pressable>
        ) : null}

        {!isVerified ? (
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {t("profile.identityVerification.primaryHint")}
          </ThemedText>
        ) : null}

        {errorMessage ? (
          <ThemedText type="caption" selectable style={{ color: palette.danger }}>
            {errorMessage}
          </ThemedText>
        ) : null}

        {infoMessage ? (
          <ThemedText type="caption" selectable style={{ color: palette.textMuted }}>
            {infoMessage}
          </ThemedText>
        ) : null}

        <View
          style={{
            gap: BrandSpacing.sm,
            padding: BrandSpacing.md,
            borderRadius: BrandRadius.card,
            borderCurve: "continuous",
            backgroundColor: diditSectionBackground,
            paddingTop: BrandSpacing.xs,
          }}
        >
          <ThemedText type="bodyStrong">{t("profile.identityVerification.whyTitle")}</ThemedText>
          <ThemedText
            type="caption"
            style={{ color: palette.textMuted, maxWidth: 580 }}
          >
            {t("profile.identityVerification.whyIntro")}
          </ThemedText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
            <LinkPill
              label={t("profile.identityVerification.systemDocs")}
              color={palette.didit.accent as string}
              onPress={() => {
                openExternalUrl(DIDIT_DOCS_URL);
              }}
            />
            <LinkPill
              label={t("profile.identityVerification.whySources.bankIsrael")}
              color={palette.didit.accent as string}
              onPress={() => {
                openExternalUrl(ISRAEL_SAFER_PAYMENTS_URL);
              }}
            />
            <LinkPill
              label={t("profile.identityVerification.whySources.amlOrder")}
              color={palette.didit.accent as string}
              onPress={() => {
                openExternalUrl(ISRAEL_AML_ORDER_URL);
              }}
            />
          </View>
        </View>
      </View>
    </ProfileSubpageScrollView>
  );
}
