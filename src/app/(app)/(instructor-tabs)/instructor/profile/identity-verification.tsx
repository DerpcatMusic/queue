import { useAction, useQuery } from "convex/react";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { NativeModules, Platform, View } from "react-native";
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

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  getIdentityStatusLabel,
  getIdentityStatusTone,
  IdentityStatusBadge,
} from "@/components/profile/identity-status-ui";
import { ThemedText } from "@/components/themed-text";
import { KitPressable, KitSuccessBurst } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";

type DiditSdkResult = {
  type?: "completed" | "cancelled" | "failed";
  error?: { message?: string };
  session?: { status?: string };
};

type DiditSdkModule = {
  startVerification: (sessionToken: string) => Promise<DiditSdkResult>;
};

let cachedDiditSdkModule: DiditSdkModule | null | undefined;

const PROCESSING_STATUSES = new Set(["in_progress", "pending", "in_review"]);

WebBrowser.maybeCompleteAuthSession();

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

function getStatusHeadline(status: string) {
  switch (status) {
    case "approved":
      return "You are verified";
    case "declined":
      return "Verification needs attention";
    case "in_review":
      return "Review in progress";
    case "pending":
      return "Verification submitted";
    case "in_progress":
      return "Finish your check";
    case "abandoned":
      return "Verification was cancelled";
    case "expired":
      return "Verification expired";
    default:
      return "Verify your identity";
  }
}

function getStatusBody(status: string) {
  switch (status) {
    case "approved":
      return "Your KYC is complete and your verified identity is active across payouts and account review.";
    case "declined":
      return "Didit declined this attempt. Start a fresh verification and double-check your legal document details.";
    case "in_review":
      return "Didit has your submission and is reviewing it now. This screen will keep checking once you return from the flow.";
    case "pending":
      return "Your submission was received. We are waiting for a final review result from Didit.";
    case "in_progress":
      return "Your verification session is active. Resume the flow and we will keep this screen locked until the final result arrives.";
    case "abandoned":
      return "The verification flow was cancelled before completion. Start again when you are ready.";
    case "expired":
      return "This verification session expired. Start a new one to continue.";
    default:
      return "Complete identity verification to unlock KYC and payout access.";
  }
}

function formatDateTime(value: number | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString();
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
          width: 12,
          height: 12,
          borderRadius: 999,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

function VerificationResolvingState({ label }: { label: string }) {
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
        paddingHorizontal: 28,
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
              top: 28,
              left: 34,
              width: 16,
              height: 16,
              borderRadius: 999,
              backgroundColor: palette.primarySubtle as string,
            },
            bubbleLeftStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              right: 40,
              bottom: 34,
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: palette.primarySubtle as string,
            },
            bubbleRightStyle,
          ]}
        />

        <Animated.View
          style={[
            {
              gap: 18,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 34,
              paddingHorizontal: 24,
              borderRadius: 28,
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
                width: 180,
                height: 180,
                borderRadius: 999,
                backgroundColor: palette.primarySubtle as string,
              },
              haloStyle,
            ]}
          />

          <Animated.View
            entering={FadeInDown.delay(90).duration(280)}
            style={{
              width: 78,
              height: 78,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: palette.borderStrong as string,
              backgroundColor: palette.surface as string,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LoaderDot delay={0} color={palette.primary as string} />
              <LoaderDot delay={140} color={palette.primary as string} />
              <LoaderDot delay={280} color={palette.primary as string} />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(150).duration(320)}
            style={{ gap: 8, alignItems: "center" }}
          >
            <ThemedText type="title" style={{ textAlign: "center" }}>
              Finalizing your verification
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
  const palette = useBrand();
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
  const previousStatusRef = useRef<string | null>(null);

  const status = localStatus ?? diditVerification?.status ?? "not_started";
  const isVerified = diditVerification?.isVerified ?? false;
  const isProcessing = isProcessingStatus(status);
  const tone = getIdentityStatusTone(status, palette);
  const legalName = diditVerification?.legalName ?? null;
  const verifiedAtLabel = formatDateTime(diditVerification?.verifiedAt);
  const lastEventAtLabel = formatDateTime(diditVerification?.lastEventAt);

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

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const latest = await refreshMyDiditVerification({});
        if (cancelled) {
          return;
        }

        setLocalStatus(latest.status);

        if (isProcessingStatus(latest.status)) {
          timeoutId = setTimeout(() => {
            void poll();
          }, 1500);
          return;
        }

        setAwaitingFinalResult(false);
        if (latest.status === "approved") {
          setInfoMessage("Identity verified. Your KYC is now active.");
          setErrorMessage(null);
        } else if (latest.status === "declined") {
          setErrorMessage(
            "Didit declined this attempt. Review your document details and try again.",
          );
          setInfoMessage(null);
        } else {
          setInfoMessage(
            `Verification finished with status: ${getIdentityStatusLabel(latest.status)}.`,
          );
          setErrorMessage(null);
        }
      } catch {
        if (cancelled) {
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
  }, [awaitingFinalResult, currentUser?.role, refreshMyDiditVerification]);

  if (
    currentUser === undefined ||
    (currentUser?.role === "instructor" && diditVerification === undefined)
  ) {
    return <LoadingScreen label="Loading verification status..." />;
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
    if (busy || awaitingFinalResult || isVerified || isProcessing) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const session = await createSessionForCurrentInstructor({ callback: diditReturnUrl });
      const sdk = await resolveDiditSdkModule();

      if (sdk) {
        const result = await sdk.startVerification(session.sessionToken);
        if (result.type === "completed") {
          beginAwaitingFinalResult("in_review");
        } else if (result.type === "cancelled") {
          setInfoMessage("Verification flow was cancelled.");
        } else {
          setErrorMessage(result.error?.message ?? "Didit could not complete this verification.");
        }
        return;
      }

      const browserResult = await WebBrowser.openAuthSessionAsync(
        session.verificationUrl,
        diditReturnUrl,
      );

      if (browserResult.type === "success") {
        beginAwaitingFinalResult("in_review");
      } else if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
        setInfoMessage("Verification flow was cancelled.");
      } else {
        setErrorMessage("Didit did not return a valid completion signal.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start Didit verification.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryAction = () => {
    if (isProcessing) {
      beginAwaitingFinalResult(status);
      return;
    }
    void startVerification();
  };

  if (awaitingFinalResult) {
    return (
      <VerificationResolvingState label="Waiting for Didit to confirm your result. Keep this screen open." />
    );
  }

  return (
    <TabScreenScrollView
      routeKey="instructor/profile"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 44, gap: 22 }}
    >
      <View style={{ paddingHorizontal: BrandSpacing.md, gap: BrandSpacing.md }}>
        {showApprovalBurst ? <KitSuccessBurst /> : null}

        <View
          style={{
            gap: 14,
            padding: 20,
            borderRadius: 28,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: tone.accent,
            backgroundColor: tone.background,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                Identity verification
              </ThemedText>
              <ThemedText type="title">{getStatusHeadline(status)}</ThemedText>
            </View>
            <IdentityStatusBadge status={status} palette={palette} />
          </View>

          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {getStatusBody(status)}
          </ThemedText>

          {legalName ? (
            <View
              style={{
                gap: 4,
                paddingTop: 2,
                borderTopWidth: 1,
                borderTopColor: palette.border as string,
              }}
            >
              <ThemedText type="micro" style={{ color: palette.textMuted }}>
                Verified legal name
              </ThemedText>
              <ThemedText type="bodyStrong">{legalName}</ThemedText>
            </View>
          ) : null}

          {verifiedAtLabel || lastEventAtLabel ? (
            <View style={{ gap: 4 }}>
              {verifiedAtLabel ? (
                <ThemedText type="caption" style={{ color: palette.textMuted }}>
                  Verified at {verifiedAtLabel}
                </ThemedText>
              ) : null}
              {lastEventAtLabel ? (
                <ThemedText type="caption" style={{ color: palette.textMuted }}>
                  Last update {lastEventAtLabel}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>

        {!isVerified ? (
          <KitPressable
            onPress={() => {
              handlePrimaryAction();
            }}
            haptic="impact"
            disabled={busy}
            style={{
              borderRadius: 18,
              borderCurve: "continuous",
              alignItems: "center",
              paddingVertical: 15,
              paddingHorizontal: 18,
              backgroundColor: busy
                ? (palette.borderStrong as string)
                : (palette.primary as string),
            }}
          >
            <ThemedText type="bodyStrong" style={{ color: palette.onPrimary as string }}>
              {busy
                ? "Starting verification..."
                : isProcessing
                  ? "Resume verification"
                  : status === "declined" || status === "expired" || status === "abandoned"
                    ? "Start a fresh verification"
                    : "Start Didit verification"}
            </ThemedText>
          </KitPressable>
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
      </View>
    </TabScreenScrollView>
  );
}
