import { useAuthActions } from "@convex-dev/auth/react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useConvexAuth } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import { SheetHeaderBlock } from "@/components/ui/sheet-header-block";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useUser } from "@/contexts/user-context";
import { useTheme } from "@/hooks/use-theme";
import {
  canUseNativeGoogleAuth,
  resolveGoogleNativeAuthConfig,
  signInWithGoogleNative,
} from "@/lib/google-auth-native";
import {
  snapshotAndClearCurrentDeviceAccount,
  switchToRememberedDeviceAccount,
  toDeviceAccountIdentity,
} from "@/modules/session/device-account-store";
import {
  consumePendingPostSignOutAuthHandoff,
  type PostSignOutAuthIntent,
  type PostSignOutAuthMethod,
  setPendingPostSignOutAuthHandoff,
} from "@/modules/session/post-signout-auth-intent";

type Step = "email" | "code";

const OTP_LENGTH = 6;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function readAuthIntent(value: string | string[] | undefined): PostSignOutAuthIntent | null {
  const param = readParam(value);
  if (param === "sign-in" || param === "sign-up") {
    return param;
  }
  return null;
}

function readAuthMethod(value: string | string[] | undefined): PostSignOutAuthMethod | null {
  const param = readParam(value);
  if (param === "apple" || param === "code" || param === "magic-link" || param === "google") {
    return param;
  }
  return null;
}

function readBooleanParam(value: string | string[] | undefined) {
  const param = readParam(value);
  return param === "1" || param === "true";
}

function MessageBanner({
  tone: _tone,
  message,
  surface,
  textColor,
}: {
  tone: "info" | "danger";
  message: string;
  surface: string;
  textColor: string;
}) {
  const backgroundColor = surface;

  return (
    <View
      style={{
        borderRadius: BrandRadius.md,
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.sm,
        backgroundColor,
      }}
    >
      <Text
        selectable
        style={{
          ...BrandType.caption,
          color: textColor,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export default function SignInScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    authFlow?: string | string[];
    code?: string | string[];
    email?: string | string[];
    intent?: string | string[];
    method?: string | string[];
    returnTo?: string | string[];
    switchAccount?: string | string[];
  }>();
  const { currentUser } = useUser();
  const { reloadAuthSession } = useAuthSession();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const googleNativeAuthConfig = useMemo(resolveGoogleNativeAuthConfig, []);
  const autoStartedMethodRef = useRef<string | null>(null);
  const handledMagicCodeRef = useRef<string | null>(null);
  const pendingAuthHandoffRef = useRef(consumePendingPostSignOutAuthHandoff());
  const [hasStartedSwitchFlow, setHasStartedSwitchFlow] = useState(false);
  const isSwitchAccountFlow = readBooleanParam(searchParams.switchAccount);
  const switchFlowReturnTo = readParam(searchParams.returnTo);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const oauthRedirectTo = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        native: "queue://sign-in",
        scheme: "queue",
        path: "sign-in",
      }),
    [],
  );
  const magicLinkRedirectTo = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        native: "queue://sign-in?authFlow=magic",
        scheme: "queue",
        path: "sign-in",
        queryParams: { authFlow: "magic" },
      }),
    [],
  );

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(
    readParam(searchParams.email) ?? pendingAuthHandoffRef.current?.email ?? "",
  );
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const authIntent =
    readAuthIntent(searchParams.intent) ?? pendingAuthHandoffRef.current?.intent ?? "sign-in";
  const pendingAuthMethod =
    readAuthMethod(searchParams.method) ?? pendingAuthHandoffRef.current?.method ?? null;
  const restoreAccountId = pendingAuthHandoffRef.current?.restoreAccountId ?? null;
  const isSignUpIntent = authIntent === "sign-up";
  const sheetTitle = isSwitchAccountFlow
    ? t("auth.switchAccountTitle")
    : step === "code"
      ? t("auth.verifyCodeButton")
      : isSignUpIntent
        ? t("auth.signUpTitle")
        : t("auth.navigation.signIn");
  const sheetSubtitle = isSwitchAccountFlow
    ? step === "code"
      ? t("auth.switchAccountCodeSubtitle")
      : t("auth.switchAccountSubtitle")
    : step === "code"
      ? t("auth.codeSheetSubtitle")
      : isSignUpIntent
        ? t("auth.signUpSubtitle")
        : t("auth.sheetSubtitle");

  const signInSheetConfig = useMemo(
    () => ({
      stickyHeader: <SheetHeaderBlock title={sheetTitle} subtitle={sheetSubtitle} tone="surface" />,
      backgroundColor: theme.color.surface,
      topInsetColor: theme.color.surface,
      padding: {
        horizontal: BrandSpacing.lg,
        vertical: BrandSpacing.sm,
      },
      steps: [step === "code" ? 0.22 : 0.2],
      initialStep: 0,
      collapsedHeightMode: "content" as const,
    }),
    [sheetSubtitle, sheetTitle, step, theme.color.surface],
  );

  useGlobalTopSheet("sign-in", signInSheetConfig);

  useEffect(() => {
    const authFlow = readParam(searchParams.authFlow);
    const magicCode = readParam(searchParams.code);
    if (authFlow !== "magic" || !magicCode || handledMagicCodeRef.current === magicCode) {
      return;
    }

    handledMagicCodeRef.current = magicCode;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    void signIn("resend", { code: magicCode })
      .then(() => {
        setInfoMessage(t("auth.magicLinkVerified"));
      })
      .catch((error) => {
        handledMagicCodeRef.current = null;
        setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [searchParams.authFlow, searchParams.code, signIn, t]);

  const normalizedEmail = email.trim();
  const isEmailReady = normalizedEmail.length > 0;

  const prepareSwitchAccountFlow = useCallback(
    async (method: PostSignOutAuthMethod) => {
      if (!isSwitchAccountFlow || hasStartedSwitchFlow || !isAuthenticated) {
        return true;
      }

      setPendingPostSignOutAuthHandoff({
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        intent: authIntent,
        method,
        ...(currentUser?._id ? { restoreAccountId: String(currentUser._id) } : {}),
      });
      setHasStartedSwitchFlow(true);
      setInfoMessage(t("auth.switchingAccounts"));
      try {
        await snapshotAndClearCurrentDeviceAccount(
          currentUser ? toDeviceAccountIdentity(currentUser) : null,
        );
        reloadAuthSession();
        return false;
      } catch (error) {
        setHasStartedSwitchFlow(false);
        setInfoMessage(null);
        setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
        return false;
      }
    },
    [
      authIntent,
      currentUser,
      hasStartedSwitchFlow,
      isAuthenticated,
      isSwitchAccountFlow,
      normalizedEmail,
      reloadAuthSession,
      t,
    ],
  );

  const handleCancelSwitch = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    if (!isAuthenticated && restoreAccountId) {
      setIsSubmitting(true);
      setErrorMessage(null);
      void switchToRememberedDeviceAccount({ accountId: restoreAccountId })
        .then(() => {
          reloadAuthSession();
          router.replace((switchFlowReturnTo ?? "/") as Href);
        })
        .catch((error) => {
          setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
        })
        .finally(() => {
          setIsSubmitting(false);
        });
      return;
    }
    if (switchFlowReturnTo) {
      router.replace(switchFlowReturnTo as Href);
      return;
    }
    router.replace("/" as Href);
  }, [
    isAuthenticated,
    isSubmitting,
    reloadAuthSession,
    restoreAccountId,
    router,
    switchFlowReturnTo,
    t,
  ]);

  const handleSendCode = useCallback(async () => {
    if (isSubmitting || !isEmailReady) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      if (!(await prepareSwitchAccountFlow("code"))) {
        return;
      }
      await signIn("resend-otp", { email: normalizedEmail });
      setStep("code");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  }, [isEmailReady, isSubmitting, normalizedEmail, prepareSwitchAccountFlow, signIn, t]);

  const handleVerifyCode = useCallback(async () => {
    if (isSubmitting || !isEmailReady) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      if (!(await prepareSwitchAccountFlow("code"))) {
        return;
      }
      await signIn("resend-otp", { email: normalizedEmail, code: code.trim() });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  }, [code, isEmailReady, isSubmitting, normalizedEmail, prepareSwitchAccountFlow, signIn, t]);

  const handleSendMagicLink = useCallback(async () => {
    if (isSubmitting || !isEmailReady) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      if (!(await prepareSwitchAccountFlow("magic-link"))) {
        return;
      }
      await signIn("resend", {
        email: normalizedEmail,
        redirectTo: magicLinkRedirectTo,
      });
      setInfoMessage(t("auth.magicLinkSent", { email: normalizedEmail }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isEmailReady,
    isSubmitting,
    magicLinkRedirectTo,
    normalizedEmail,
    prepareSwitchAccountFlow,
    signIn,
    t,
  ]);

  const handleOAuth = useCallback(
    async (provider: "google" | "apple") => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      setErrorMessage(null);
      setInfoMessage(null);
      try {
        if (!(await prepareSwitchAccountFlow(provider))) {
          return;
        }

        if (provider === "google" && canUseNativeGoogleAuth(googleNativeAuthConfig)) {
          const nativeGoogleConfig = googleNativeAuthConfig;
          const nativeResult = await signInWithGoogleNative({
            config: nativeGoogleConfig,
          });
          if (nativeResult.type === "cancelled") {
            setErrorMessage(t("auth.oauthCancelled"));
            return;
          }

          await signIn("google-native", { idToken: nativeResult.idToken });
          return;
        }

        const started = await signIn(provider, {
          redirectTo: oauthRedirectTo,
          ...(provider === "google" && (isSwitchAccountFlow || normalizedEmail.length > 0)
            ? {
                prompt: "select_account",
                ...(normalizedEmail ? { login_hint: normalizedEmail } : {}),
              }
            : {}),
        });
        if (!started.redirect) return;
        const oauthResult = await WebBrowser.openAuthSessionAsync(
          started.redirect.toString(),
          oauthRedirectTo,
        );
        if (oauthResult.type === "cancel") {
          setErrorMessage(t("auth.oauthCancelled"));
          return;
        }
        if (oauthResult.type !== "success" || !oauthResult.url) {
          return;
        }
        const url = new URL(oauthResult.url);
        const oauthCode = url.searchParams.get("code");
        if (!oauthCode) {
          setErrorMessage(t("auth.oauthFailed"));
          return;
        }
        await signIn(provider, { code: oauthCode });
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      googleNativeAuthConfig,
      isSubmitting,
      isSwitchAccountFlow,
      normalizedEmail,
      oauthRedirectTo,
      prepareSwitchAccountFlow,
      signIn,
      t,
    ],
  );

  useEffect(() => {
    const canAutoStart =
      pendingAuthMethod === "apple" ||
      pendingAuthMethod === "google" ||
      pendingAuthMethod === "magic-link" ||
      isEmailReady;
    if (!pendingAuthMethod || !canAutoStart || isSubmitting) {
      return;
    }

    const autoStartKey = `${pendingAuthMethod}:${normalizedEmail.toLowerCase()}`;
    if (autoStartedMethodRef.current === autoStartKey) {
      return;
    }

    autoStartedMethodRef.current = autoStartKey;
    if (pendingAuthMethod === "code") {
      void handleSendCode();
      return;
    }
    if (pendingAuthMethod === "magic-link") {
      void handleSendMagicLink();
      return;
    }
    void handleOAuth(pendingAuthMethod === "apple" ? "apple" : "google");
  }, [
    handleOAuth,
    handleSendCode,
    handleSendMagicLink,
    isEmailReady,
    isSubmitting,
    normalizedEmail,
    pendingAuthMethod,
  ]);

  if (
    isAuthenticated &&
    (!isSwitchAccountFlow || hasStartedSwitchFlow || pendingAuthHandoffRef.current !== null)
  ) {
    return <Redirect href="/" />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.color.appBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TabScreenScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        useDesktopFrame={false}
        sheetInsets={{
          topSpacing: BrandSpacing.lg,
          bottomSpacing: BrandSpacing.xxl,
          horizontalPadding: BrandSpacing.lg,
        }}
        contentContainerStyle={{
          flexGrow: 1,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'space-between', gap: BrandSpacing.xl }}>
          <View style={{ gap: BrandSpacing.lg }}>
            <KitTextField
              value={email}
              onChangeText={setEmail}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              inputMode="email"
              placeholder={t("auth.emailPlaceholder")}
              leading={<FontAwesome5 name="at" size={16} color={theme.color.textMuted} />}
              style={styles.emailInput}
            />

            {step === "email" ? (
              <>
                <View style={{ flexDirection: 'row', gap: BrandSpacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      label={isSubmitting ? t("auth.signingIn") : t("auth.sendCodeButton")}
                      onPress={() => {
                        void handleSendCode();
                      }}
                      disabled={isSubmitting || !isEmailReady}
                      fullWidth
                      size="lg"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      label={t("auth.sendMagicLinkButton")}
                      onPress={() => {
                        void handleSendMagicLink();
                      }}
                      disabled={isSubmitting || !isEmailReady}
                      tone="secondary"
                      fullWidth
                      size="lg"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: BrandSpacing.sm, paddingVertical: BrandSpacing.xs }}>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border }} />
                  <Text
                    style={{
                      ...BrandType.micro,
                      letterSpacing: 0.7,
                      textTransform: 'uppercase',
                      color: theme.color.textMuted,
                    }}
                  >
                    {t("auth.or")}
                  </Text>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border }} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: BrandSpacing.sm }}>
                  <IconButton
                    accessibilityLabel={
                      isSignUpIntent ? t("auth.signUpWithGoogle") : t("auth.signInWithGoogle")
                    }
                    icon={<FontAwesome5 name="google" size={26} color={theme.color.danger} />}
                    onPress={() => {
                      void handleOAuth("google");
                    }}
                    disabled={isSubmitting}
                  />
                  <IconButton
                    accessibilityLabel={t("auth.signInWithApple")}
                    icon={<FontAwesome5 name="apple" size={30} color={theme.color.text} />}
                    onPress={() => {
                      void handleOAuth("apple");
                    }}
                    disabled={isSubmitting}
                  />
                </View>
                {isSwitchAccountFlow && isAuthenticated && !hasStartedSwitchFlow ? (
                  <ActionButton
                    label={t("auth.keepCurrentAccount")}
                    onPress={handleCancelSwitch}
                    disabled={isSubmitting}
                    tone="secondary"
                    fullWidth
                    size="lg"
                  />
                ) : null}
              </>
            ) : (
              <View style={{ gap: BrandSpacing.sm }}>
                <Text
                  style={{
                    textAlign: 'center',
                    ...BrandType.caption,
                    color: theme.color.textMuted,
                  }}
                >
                  {normalizedEmail}
                </Text>
                <KitTextField
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  textContentType="oneTimeCode"
                  placeholder="123456"
                  style={styles.codeInput}
                />
                <View style={{ flexDirection: 'row', gap: BrandSpacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      label={isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCodeButton")}
                      onPress={() => {
                        void handleVerifyCode();
                      }}
                      disabled={isSubmitting || code.length !== OTP_LENGTH}
                      fullWidth
                      size="lg"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      label={t("auth.backToSignInMethods")}
                      onPress={() => {
                        setStep("email");
                        setCode("");
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      disabled={isSubmitting}
                      tone="secondary"
                      fullWidth
                      size="lg"
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={{ gap: BrandSpacing.sm }}>
            {infoMessage ? (
              <MessageBanner
                tone="info"
                message={infoMessage}
                surface={theme.color.surfaceAlt}
                textColor={theme.color.textMuted}
              />
            ) : null}
            {errorMessage ? (
              <MessageBanner
                tone="danger"
                message={errorMessage}
                surface={theme.color.dangerSubtle}
                textColor={theme.color.danger}
              />
            ) : null}
          </View>
        </View>
      </TabScreenScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  emailInput: {
    fontFamily: "Manrope_500Medium",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    includeFontPadding: false,
  },
  codeInput: {
    fontFamily: "Lexend_600SemiBold",
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 10,
    lineHeight: 32,
    textAlign: "center",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
});
