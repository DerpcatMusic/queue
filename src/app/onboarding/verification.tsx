import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { AddressCollectionMode, CollectionMode } from "@stripe/stripe-react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { StyleSheet } from "react-native-unistyles";
import { StudioBusinessInfoForm } from "@/components/compliance/studio-business-info-form";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { AnimatedAuroraBackground } from "@/components/ui/aurora-background";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { api } from "@/convex/_generated/api";
import { getPaymentMethodOrder } from "@/features/payments/lib/get-payment-method-order";
import { presentStripeNativeSetupSheet } from "@/features/payments/lib/stripe-native";
import { useLocationStorage, useStudioProfileStorage } from "@/hooks/use-onboarding-storage";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { getStripeMarketDefaults, getStripeSetupCountry } from "@/lib/stripe";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Aurora config
const STUDIO_AURORA_LIGHT = {
  skyTop: [0.2, 0.45, 0.9] as [number, number, number],
  aur1: [0.28, 0.55, 0.98] as [number, number, number],
  aur2: [0.34, 0.62, 0.99] as [number, number, number],
  aur3: [0.22, 0.5, 0.92] as [number, number, number],
};
const STUDIO_AURORA_DARK = {
  skyTop: [0.08, 0.16, 0.28] as [number, number, number],
  aur1: [0.14, 0.3, 0.72] as [number, number, number],
  aur2: [0.18, 0.38, 0.88] as [number, number, number],
  aur3: [0.12, 0.26, 0.62] as [number, number, number],
};
const LIGHT_SKY_BOTTOM = [0.95, 0.94, 0.92] as [number, number, number];
const DARK_SKY_BOTTOM = [0.015, 0.02, 0.035] as [number, number, number];

function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: disabled ? theme.color.surfaceMuted : theme.color.primary,
    opacity: pressed.value === 1 ? 0.85 : 1,
  }));

  return (
    <AnimatedPressable
      disabled={disabled || loading}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        pressed.value = 1;
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        pressed.value = 0;
      }}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={[styles.appButton, animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.color.onPrimary} />
      ) : (
        <>
          {icon && (
            <MaterialIcons
              name={icon}
              size={22}
              color={theme.color.onPrimary}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.appButtonText,
              { color: disabled ? theme.color.textMuted : theme.color.onPrimary },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pressed.value === 1 ? 0.7 : 1,
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        pressed.value = 1;
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        pressed.value = 0;
      }}
      style={[styles.backButton, animatedStyle]}
    >
      <MaterialIcons name="arrow-back" size={24} color={theme.color.danger} />
    </AnimatedPressable>
  );
}

function VerificationRow({
  icon,
  title,
  subtitle,
  status,
  loading,
  disabled,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  status?: "done" | "pending" | "action";
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value === 1 ? 0.98 : 1 }],
    opacity: pressed.value === 1 ? 0.9 : 1,
  }));

  return (
    <AnimatedPressable
      disabled={disabled || loading || !onPress}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      style={[styles.verificationRow, animatedStyle]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.color.primarySubtle }]}>
        <MaterialIcons name={icon} size={22} color={theme.color.primary} />
      </View>
      <View style={styles.rowContent}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.rowTitle, { color: theme.color.text }]}>{title}</Text>
          {status === "done" && (
            <MaterialIcons name="check-circle" size={18} color={theme.color.success} />
          )}
          {status === "pending" && (
            <MaterialIcons name="schedule" size={18} color={theme.color.warning} />
          )}
        </View>
        <Text style={[styles.rowSubtitle, { color: theme.color.textMuted }]}>{subtitle}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.color.primary} />
      ) : (
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={disabled ? theme.color.textMuted : theme.color.textMuted}
        />
      )}
    </AnimatedPressable>
  );
}

export default function VerificationScreen() {
  const router = useRouter();
  const { role, focus } = useLocalSearchParams<{ role: string; focus?: string }>();
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isStudioRoute = role === "studio";
  const isDark = resolvedScheme === "dark";

  const currentUser = useQuery(api.users.getCurrent.getCurrentUser);
  const { data: studioProfile } = useStudioProfileStorage();
  const { data: location } = useLocationStorage();
  const canLoadStudioCompliance = currentUser?.role === "studio";

  const studioComplianceDetails = useQuery(
    api.compliance.studio.getMyStudioComplianceDetails,
    canLoadStudioCompliance ? {} : "skip",
  );
  const studioAccessSnapshot = useQuery(
    api.access.snapshots.getMyStudioAccessSnapshot,
    canLoadStudioCompliance ? {} : "skip",
  );
  const createDiditSession = useAction(api.payments.actions.createMyStudioDiditVerificationSession);
  const refreshDiditStatus = useAction(api.payments.actions.refreshMyStudioDiditVerification);
  const createCustomerSheetSession = useAction(
    api.payments.actions.createMyStudioStripeCustomerSheetSession,
  );
  const syncStudioPaymentProfile = useAction(api.payments.actions.syncMyStudioStripePaymentProfile);
  const upsertMyStudioBillingProfile = useMutation(
    api.compliance.studio.upsertMyStudioBillingProfile,
  );

  const [isPresentingDidit, setIsPresentingDidit] = useState(false);
  const [isPresentingStripe, setIsPresentingStripe] = useState(false);
  const [diditError, setDiditError] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [diditStatus, setDiditStatus] = useState<string | null>(null);
  const [stripeSaved, setStripeSaved] = useState(false);
  const [isBusinessSheetVisible, setIsBusinessSheetVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const stripeSetupSheetSessionPromiseRef = useRef<Promise<{
    customerId: string;
    customerSessionClientSecret: string;
    setupIntentClientSecret: string;
  }> | null>(null);
  const paymentMethodTypes = useMemo(
    () => getPaymentMethodOrder(getStripeMarketDefaults().currency),
    [],
  );
  const stripeSetupCountry = useMemo(
    () => getStripeSetupCountry(studioComplianceDetails?.billingProfile?.country),
    [studioComplianceDetails?.billingProfile?.country],
  );

  useEffect(() => {
    if (studioAccessSnapshot?.verification.status) {
      setDiditStatus(studioAccessSnapshot.verification.status);
    }
  }, [studioAccessSnapshot?.verification.status]);

  useEffect(() => {
    if (studioAccessSnapshot?.compliance.summary.paymentStatus === "ready") {
      setStripeSaved(true);
    }
  }, [studioAccessSnapshot?.compliance.summary.paymentStatus]);

  useLayoutEffect(() => {
    if (focus === "business") {
      setIsBusinessSheetVisible(true);
    }
  }, [focus]);

  const handleStartDidit = async () => {
    setIsPresentingDidit(true);
    setDiditError(null);
    try {
      const session = await createDiditSession({});
      if (Platform.OS === "web") {
        await WebBrowser.openBrowserAsync(session.verificationUrl);
        return;
      }
      const { startVerification: startDiditVerification } = await import(
        "@didit-protocol/sdk-react-native"
      );
      const result = await startDiditVerification(session.sessionToken, {
        loggingEnabled: __DEV__,
      });
      if (result.type === "completed") {
        const statusResult = await refreshDiditStatus({ sessionId: result.session.sessionId });
        setDiditStatus(statusResult.status);
      } else if (result.type === "failed") {
        setDiditError(result.error.message || "Verification failed");
      }
    } catch (err) {
      setDiditError(err instanceof Error ? err.message : "Failed to start verification");
    } finally {
      setIsPresentingDidit(false);
    }
  };

  const handleBusinessDetailsPress = useCallback(() => {
    setIsBusinessSheetVisible(true);
  }, []);

  const stripeCustomerSheetAppearance = useMemo(
    () =>
      ({
        colors: isDark
          ? {
              primary: theme.color.primary,
              background: theme.color.appBg,
              componentBackground: theme.color.surface,
              componentBorder: theme.color.border,
              componentDivider: theme.color.border,
              primaryText: theme.color.text,
              secondaryText: theme.color.textMuted,
              componentText: theme.color.text,
              placeholderText: theme.color.textMuted,
              icon: theme.color.textMuted,
              error: theme.color.danger,
            }
          : {
              primary: theme.color.primary,
              background: theme.color.appBg,
              componentBackground: theme.color.surface,
              componentBorder: theme.color.border,
              componentDivider: theme.color.border,
              primaryText: theme.color.text,
              secondaryText: theme.color.textMuted,
              componentText: theme.color.text,
              placeholderText: theme.color.textMuted,
              icon: theme.color.textMuted,
              error: theme.color.danger,
            },
        shapes: {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          shadow: {
            color: "#000000",
            opacity: isDark ? 0.3 : 0.12,
            offset: { x: 0, y: 4 },
            blurRadius: 18,
          },
        },
        primaryButton: {
          colors: {
            background: theme.color.primary,
            text: theme.color.onPrimary,
            border: theme.color.primary,
            successBackgroundColor: theme.color.primary,
            successTextColor: theme.color.onPrimary,
          },
          shapes: {
            borderRadius: theme.radius.xl,
            borderWidth: 0,
            shadow: {
              color: "#000000",
              opacity: isDark ? 0.18 : 0.1,
              offset: { x: 0, y: 2 },
              blurRadius: 10,
            },
            height: 60,
          },
        },
      }) as any,
    [
      isDark,
      theme.color.appBg,
      theme.color.border,
      theme.color.danger,
      theme.color.onPrimary,
      theme.color.primary,
      theme.color.surface,
      theme.color.text,
      theme.color.textMuted,
      theme.radius.xl,
    ],
  );

  const handleStripeSetupOpen = useCallback(async () => {
    setStripeError(null);
    setIsPresentingStripe(true);
    try {
      stripeSetupSheetSessionPromiseRef.current ??= createCustomerSheetSession({});
      const session = await stripeSetupSheetSessionPromiseRef.current;
      const result = await presentStripeNativeSetupSheet({
        setupIntentClientSecret: session.setupIntentClientSecret,
        customerSessionClientSecret: session.customerSessionClientSecret,
        customerId: session.customerId,
        merchantDisplayName: "Queue",
        billingName: studioProfile.studioName || studioProfile.legalBusinessName || "Studio",
        paymentMethodOrder: paymentMethodTypes,
        appearance: stripeCustomerSheetAppearance,
        style: isDark ? "alwaysDark" : "alwaysLight",
        defaultBillingDetails: {
          ...(studioProfile.studioName ? { name: studioProfile.studioName } : {}),
          ...(stripeSetupCountry ? { address: { country: stripeSetupCountry } } : {}),
        },
        billingDetailsCollectionConfiguration: {
          name: "always" as CollectionMode,
          email: "automatic" as CollectionMode,
          address: "automatic" as AddressCollectionMode,
          attachDefaultsToPaymentMethod: true,
        },
      });

      if (result.status === "canceled") {
        return;
      }
      if (result.status === "failed") {
        setStripeError(result.error);
        return;
      }

      setStripeSaved(true);
      void syncStudioPaymentProfile().catch(() => {
        // Payment method was added; compliance sync can retry later.
      });
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Failed to initialize Stripe");
    } finally {
      setIsPresentingStripe(false);
    }
  }, [
    createCustomerSheetSession,
    isDark,
    paymentMethodTypes,
    stripeCustomerSheetAppearance,
    stripeSetupCountry,
    studioProfile.legalBusinessName,
    studioProfile.studioName,
    syncStudioPaymentProfile,
  ]);

  const getDiditRowStatus = (): "done" | "pending" | "action" => {
    if (diditStatus === "approved") return "done";
    if (diditStatus === "pending" || diditStatus === "in_review") return "pending";
    return "action";
  };

  const getBusinessRowStatus = (): "done" | "action" => {
    if (studioAccessSnapshot?.compliance.summary.businessProfileStatus === "complete") {
      return "done";
    }
    return "action";
  };

  const isBusinessDone = getBusinessRowStatus() === "done";
  const isIdentityDone = getDiditRowStatus() === "done";
  const isAllDone = isBusinessDone && isIdentityDone && stripeSaved;

  return (
    <View style={[styles.container, { backgroundColor: theme.color.appBg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Aurora Background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AnimatedAuroraBackground
          width={width}
          height={height}
          skyTopShared={isDark ? STUDIO_AURORA_DARK.skyTop : STUDIO_AURORA_LIGHT.skyTop}
          aur1Shared={isDark ? STUDIO_AURORA_DARK.aur1 : STUDIO_AURORA_LIGHT.aur1}
          aur2Shared={isDark ? STUDIO_AURORA_DARK.aur2 : STUDIO_AURORA_LIGHT.aur2}
          aur3Shared={isDark ? STUDIO_AURORA_DARK.aur3 : STUDIO_AURORA_LIGHT.aur3}
          skyBottom={isDark ? DARK_SKY_BOTTOM : LIGHT_SKY_BOTTOM}
          intensity={isDark ? 0.26 : 0.34}
          baseSpeed={0.5}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: theme.color.appBg, opacity: isDark ? 0.04 : 0.08 },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, paddingTop: insets.top }}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Animated.Text
              entering={FadeInDown.delay(100)}
              style={[styles.title, { color: theme.color.text }]}
            >
              {isStudioRoute ? "Studio verification" : "Verify your identity"}
            </Animated.Text>
            <Animated.View entering={FadeInDown.delay(180)} style={styles.rowStack}>
              <VerificationRow
                icon="person"
                title="Identity check"
                subtitle={
                  diditStatus === "approved"
                    ? "Verified via Didit"
                    : "Start Didit verification flow"
                }
                status={getDiditRowStatus()}
                onPress={handleStartDidit}
              />

              {isStudioRoute ? (
                <>
                  <VerificationRow
                    icon="business"
                    title="Business details"
                    subtitle={
                      isBusinessDone ? "Legal name and registration saved" : "Open business details"
                    }
                    status={getBusinessRowStatus()}
                    onPress={handleBusinessDetailsPress}
                  />

                  <VerificationRow
                    icon="account-balance-wallet"
                    title="Payment method"
                    subtitle={
                      stripeSaved ? "Stripe connected" : "Connect Stripe to pay instructors"
                    }
                    status={stripeSaved ? "done" : "action"}
                    loading={isPresentingStripe}
                    onPress={handleStripeSetupOpen}
                  />
                </>
              ) : null}
            </Animated.View>

            {diditError && (
              <Animated.View
                entering={FadeInDown.delay(400)}
                style={[styles.errorBox, { backgroundColor: theme.color.dangerSubtle }]}
              >
                <MaterialIcons name="error-outline" size={20} color={theme.color.danger} />
                <Text style={[styles.errorText, { color: theme.color.danger }]}>{diditError}</Text>
              </Animated.View>
            )}

            {stripeError && (
              <Animated.View
                entering={FadeInDown.delay(400)}
                style={[styles.errorBox, { backgroundColor: theme.color.dangerSubtle }]}
              >
                <MaterialIcons name="error-outline" size={20} color={theme.color.danger} />
                <Text style={[styles.errorText, { color: theme.color.danger }]}>{stripeError}</Text>
              </Animated.View>
            )}

            {isPresentingDidit && (
              <Animated.View
                entering={FadeInDown.delay(400)}
                style={[styles.loadingBox, { backgroundColor: theme.color.primarySubtle }]}
              >
                <ActivityIndicator size="small" color={theme.color.primary} />
                <Text style={[styles.loadingText, { color: theme.color.primary }]}>
                  Opening Didit verification...
                </Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
        <View
          pointerEvents="box-none"
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 16, paddingHorizontal: theme.spacing.lg },
          ]}
        >
          <View pointerEvents="none" style={styles.footerFade}>
            <Svg pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
              <Defs>
                <SvgLinearGradient id="onboarding-footer-fade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={theme.color.appBg} stopOpacity="0" />
                  <Stop offset="55%" stopColor={theme.color.appBg} stopOpacity="0.82" />
                  <Stop offset="100%" stopColor={theme.color.appBg} stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#onboarding-footer-fade)" />
            </Svg>
          </View>
          <View style={styles.footerButtons}>
            <BackButton onPress={() => router.back()} />
            <PrimaryButton
              title={isAllDone ? "Finish" : "Complete setup"}
              onPress={() => {
                if (isStudioRoute && !isBusinessDone) {
                  setIsBusinessSheetVisible(true);
                  return;
                }
                if (!isIdentityDone) {
                  void handleStartDidit();
                  return;
                }
                if (isStudioRoute && !stripeSaved) {
                  void handleStripeSetupOpen();
                  return;
                }
                router.replace("/");
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <BaseProfileSheet
        visible={isBusinessSheetVisible}
        onClose={() => setIsBusinessSheetVisible(false)}
        scrollable
        snapPoints={["96%"]}
      >
        <StudioBusinessInfoForm
          billingProfile={studioComplianceDetails?.billingProfile ?? null}
          saveBillingProfile={upsertMyStudioBillingProfile}
          defaultBusinessName={studioProfile.studioName || currentUser?.fullName || ""}
          {...(currentUser?.email ? { currentUserEmail: currentUser.email } : {})}
          {...(currentUser?.phoneE164 ? { currentUserPhone: currentUser.phoneE164 } : {})}
          {...(location?.countryCode ? { defaultCountryCode: location.countryCode } : {})}
          autoSave={false}
        />
      </BaseProfileSheet>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
  title: {
    fontFamily: theme.fontFamily.kanitExtraBold,
    fontSize: 38,
    lineHeight: 48,
    letterSpacing: -0.8,
    marginBottom: theme.spacing.sm,
  },
  rowStack: {
    gap: theme.spacing.md,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: theme.fontFamily.bodyStrong, fontSize: 16, lineHeight: 22 },
  rowSubtitle: { fontFamily: theme.fontFamily.body, fontSize: 14, lineHeight: 20 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.lg,
  },
  errorText: { fontFamily: theme.fontFamily.body, fontSize: 14, flex: 1 },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.lg,
  },
  loadingText: { fontFamily: theme.fontFamily.bodyMedium, fontSize: 14 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 76,
  },
  footerButtons: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
    position: "relative",
    zIndex: 1,
    paddingTop: theme.spacing.md,
  },
  backButton: {
    width: 64,
    height: 60,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.color.dangerSubtle,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  appButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: theme.spacing.xl,
  },
  appButtonText: { fontFamily: theme.fontFamily.bodyStrong, fontSize: 18, lineHeight: 26 },
}));
