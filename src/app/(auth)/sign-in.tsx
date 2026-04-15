import { useAuthActions } from "@convex-dev/auth/react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useConvexAuth } from "convex/react";
import * as AuthSession from "expo-auth-session";
import {
  type Href,
  Redirect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { ActionButton } from "@/components/ui/action-button";
import { KitSurface } from "@/components/ui/kit/kit-surface";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useUser } from "@/contexts/user-context";
import { signInWithAppleNative } from "@/lib/apple-auth-native";
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

import { FontSize, LetterSpacing, getTheme } from "@/theme/theme";

type Step = "email" | "code";

const OTP_LENGTH = 6;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function normalizeHex(color: string) {
  const value = color.trim();
  if (!value.startsWith("#")) {
    return null;
  }

  const hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    return `#${hex
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }

  if (hex.length === 6 || hex.length === 8) {
    return `#${hex}`;
  }

  return null;
}

function withAlpha(color: string, alphaHex: string) {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return color;
  }

  return `${normalized.slice(0, 7)}${alphaHex}`;
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function readAuthIntent(
  value: string | string[] | undefined,
): PostSignOutAuthIntent | null {
  const param = readParam(value);
  if (param === "sign-in" || param === "sign-up") {
    return param;
  }
  return null;
}

function readAuthMethod(
  value: string | string[] | undefined,
): PostSignOutAuthMethod | null {
  const param = readParam(value);
  if (
    param === "apple" ||
    param === "code" ||
    param === "magic-link" ||
    param === "google"
  ) {
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
  const authPalette = getTheme("dark").color;
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const router = useRouter();
  const { setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible } =
    useSystemUi();
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
  const { restartAppSession } = useAuthSession();
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

  useEffect(() => {
    setTopInsetVisible(false);
    setTopInsetBackgroundColor("transparent");
    setTopInsetTone("app");

    return () => {
      setTopInsetVisible(true);
      setTopInsetBackgroundColor(null);
      setTopInsetTone("app");
    };
  }, [setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible]);

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
    readAuthIntent(searchParams.intent) ??
    pendingAuthHandoffRef.current?.intent ??
    "sign-in";
  const pendingAuthMethod =
    readAuthMethod(searchParams.method) ??
    pendingAuthHandoffRef.current?.method ??
    null;
  const restoreAccountId =
    pendingAuthHandoffRef.current?.restoreAccountId ?? null;

  useEffect(() => {
    const authFlow = readParam(searchParams.authFlow);
    const magicCode = readParam(searchParams.code);
    if (
      authFlow !== "magic" ||
      !magicCode ||
      handledMagicCodeRef.current === magicCode
    ) {
      return;
    }

    handledMagicCodeRef.current = magicCode;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    void signIn("resend", { code: magicCode })
      .then(() => {
        restartAppSession({
          immediate: true,
          reloadAuth: true,
          transitionMs: 7000,
        });
        setInfoMessage(t("auth.magicLinkVerified"));
      })
      .catch((error) => {
        handledMagicCodeRef.current = null;
        setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [restartAppSession, searchParams.authFlow, searchParams.code, signIn, t]);

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
        ...(currentUser?._id
          ? { restoreAccountId: String(currentUser._id) }
          : {}),
      });
      setHasStartedSwitchFlow(true);
      setInfoMessage(t("auth.switchingAccounts"));
      try {
        await snapshotAndClearCurrentDeviceAccount(
          currentUser ? toDeviceAccountIdentity(currentUser) : null,
        );
        restartAppSession({
          immediate: true,
          reloadAuth: true,
          transitionMs: 7000,
        });
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
      restartAppSession,
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
          restartAppSession({
            immediate: true,
            reloadAuth: true,
            transitionMs: 7000,
          });
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
    restartAppSession,
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
  }, [
    isEmailReady,
    isSubmitting,
    normalizedEmail,
    prepareSwitchAccountFlow,
    signIn,
    t,
  ]);

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
      restartAppSession({
        immediate: true,
        reloadAuth: true,
        transitionMs: 7000,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    code,
    isEmailReady,
    isSubmitting,
    normalizedEmail,
    prepareSwitchAccountFlow,
    restartAppSession,
    signIn,
    t,
  ]);

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

        if (
          provider === "google" &&
          canUseNativeGoogleAuth(googleNativeAuthConfig)
        ) {
          const nativeGoogleConfig = googleNativeAuthConfig;
          const nativeResult = await signInWithGoogleNative({
            config: nativeGoogleConfig,
          });
          if (nativeResult.type === "cancelled") {
            setErrorMessage(t("auth.oauthCancelled"));
            return;
          }

          await signIn("google-native", { idToken: nativeResult.idToken });
          restartAppSession({
            immediate: true,
            reloadAuth: true,
            transitionMs: 7000,
          });
          return;
        }

        if (provider === "apple") {
          const nativeResult = await signInWithAppleNative();
          if (nativeResult.type === "success") {
            await signIn("apple-native", {
              idToken: nativeResult.identityToken,
            });
            restartAppSession({
              immediate: true,
              reloadAuth: true,
              transitionMs: 7000,
            });
            return;
          }
          if (nativeResult.type === "cancelled") {
            setErrorMessage(t("auth.oauthCancelled"));
            return;
          }
        }

        const started = await signIn(provider, {
          redirectTo: oauthRedirectTo,
          ...(provider === "google" &&
          (isSwitchAccountFlow || normalizedEmail.length > 0)
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
        restartAppSession({
          immediate: true,
          reloadAuth: true,
          transitionMs: 7000,
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currentUser,
      googleNativeAuthConfig,
      isSubmitting,
      isSwitchAccountFlow,
      normalizedEmail,
      oauthRedirectTo,
      prepareSwitchAccountFlow,
      restartAppSession,
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

  const heroTitle = isSwitchAccountFlow
    ? t("auth.switchAccountTitle")
    : t("auth.signInTitle");
  const auroraHeight = Math.max(380, height * 0.58);
  const socialBorderColor = withAlpha(authPalette.text, "12");
  const socialSurfaceColor = withAlpha("#0b0e14", "A8");
  const fieldSurfaceColor = withAlpha("#0b0e14", "98");
  const fieldPlaceholderColor = withAlpha(authPalette.text, "66");

  if (
    isAuthenticated &&
    (!isSwitchAccountFlow ||
      hasStartedSwitchFlow ||
      pendingAuthHandoffRef.current !== null)
  ) {
    return <Redirect href="/" />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: authPalette.appBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.auroraFrame,
            {
              height: auroraHeight,
            },
          ]}
        >
          <AuroraBackground
            width={width}
            height={auroraHeight}
            intensity={0.72}
            speed={0.74}
            skyColors={["#112a52", authPalette.appBg]}
            auroraColors={["#24498b", "#1d6de0", "#395ea8"]}
            waveDirection={[8, -6]}
          />
        </View>
      </View>
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
        <View style={styles.shell}>
          <View style={styles.heroBlock}>
            <Text style={[styles.heroTitle, { color: authPalette.text }]}>
              {heroTitle}
            </Text>
          </View>

          <View style={styles.formBlock}>
            {step === "email" ? (
              <>
                <View style={styles.socialRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("auth.signInWithGoogle")}
                    onPress={() => {
                      void handleOAuth("google");
                    }}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      styles.socialPressable,
                      { opacity: pressed || isSubmitting ? 0.82 : 1 },
                    ]}
                  >
                    <KitSurface
                      tone="glass"
                      padding={0}
                      radius={14}
                      style={[
                        styles.socialButtonCompact,
                        {
                          backgroundColor: socialSurfaceColor,
                          borderColor: socialBorderColor,
                        },
                      ]}
                    >
                      <FontAwesome5
                        name="google"
                        size={20}
                        color={authPalette.text}
                      />
                      <Text
                        style={[
                          styles.socialCompactLabel,
                          { color: authPalette.text },
                        ]}
                      >
                        Google
                      </Text>
                    </KitSurface>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("auth.signInWithApple")}
                    onPress={() => {
                      void handleOAuth("apple");
                    }}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      styles.socialPressable,
                      { opacity: pressed || isSubmitting ? 0.82 : 1 },
                    ]}
                  >
                    <KitSurface
                      tone="glass"
                      padding={0}
                      radius={14}
                      style={[
                        styles.socialButtonCompact,
                        {
                          backgroundColor: socialSurfaceColor,
                          borderColor: socialBorderColor,
                        },
                      ]}
                    >
                      <FontAwesome5
                        name="apple"
                        size={22}
                        color={authPalette.text}
                      />
                      <Text
                        style={[
                          styles.socialCompactLabel,
                          { color: authPalette.text },
                        ]}
                      >
                        Apple
                      </Text>
                    </KitSurface>
                  </Pressable>
                </View>

                <View style={styles.dividerRow}>
                  <View
                    style={[
                      styles.dividerLineWide,
                      { backgroundColor: withAlpha(authPalette.text, "08") },
                    ]}
                  />
                  <Text
                    style={[
                      styles.dividerLabel,
                      { color: authPalette.textMuted },
                    ]}
                  >
                    {t("auth.or").toUpperCase()}
                  </Text>
                  <View
                    style={[
                      styles.dividerLineWide,
                      { backgroundColor: withAlpha(authPalette.text, "08") },
                    ]}
                  />
                </View>

                <View style={styles.inputContainerBox}>
                  <Text
                    style={[styles.inputLabel, { color: authPalette.text }]}
                  >
                    {t("auth.emailLabel")}
                  </Text>
                  <KitSurface
                    tone="glass"
                    padding={0}
                    radius={16}
                    style={[
                      styles.inputSurface,
                      {
                        backgroundColor: fieldSurfaceColor,
                      },
                    ]}
                  >
                    <FontAwesome5
                      name="at"
                      size={16}
                      color={withAlpha(authPalette.text, "66")}
                      style={styles.inputIcon}
                    />
                    <TextInput
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
                      placeholderTextColor={fieldPlaceholderColor}
                      accessibilityLabel={t("auth.email")}
                      selectionColor={authPalette.primary}
                      cursorColor={authPalette.primary}
                      style={[styles.emailInput, { color: authPalette.text }]}
                    />
                  </KitSurface>
                </View>

                <ActionButton
                  label={
                    isSubmitting
                      ? t("auth.signingIn")
                      : t("auth.sendCodeButton")
                  }
                  onPress={() => {
                    void handleSendCode();
                  }}
                  disabled={isSubmitting || !isEmailReady}
                  fullWidth
                  size="lg"
                />

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

                {isSwitchAccountFlow &&
                isAuthenticated &&
                !hasStartedSwitchFlow ? (
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
              <View style={styles.codeBlock}>
                <View
                  style={[
                    styles.codeEmailChip,
                    {
                      backgroundColor: "#0d1016",
                      borderColor: withAlpha(authPalette.text, "10"),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.codeEmailText,
                      { color: authPalette.textMuted },
                    ]}
                  >
                    {normalizedEmail}
                  </Text>
                </View>
                <View style={styles.inputContainerBox}>
                  <Text
                    style={[styles.inputLabel, { color: authPalette.text }]}
                  >
                    {t("auth.codeLabel")}
                  </Text>
                  <KitSurface
                    tone="glass"
                    padding={0}
                    radius={16}
                    style={[
                      styles.inputSurface,
                      {
                        backgroundColor: fieldSurfaceColor,
                      },
                    ]}
                  >
                    <TextInput
                      value={code}
                      onChangeText={(value) =>
                        setCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                      }
                      autoFocus
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      textContentType="oneTimeCode"
                      placeholder="123456"
                      placeholderTextColor={fieldPlaceholderColor}
                      selectionColor={authPalette.primary}
                      cursorColor={authPalette.primary}
                      style={[styles.codeInput, { color: authPalette.text }]}
                    />
                  </KitSurface>
                </View>
                <ActionButton
                  label={
                    isSubmitting
                      ? t("auth.verifyingCode")
                      : t("auth.verifyCodeButton")
                  }
                  onPress={() => {
                    void handleVerifyCode();
                  }}
                  disabled={isSubmitting || code.length !== OTP_LENGTH}
                  fullWidth
                  size="lg"
                />
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
            )}

            <View style={styles.messageStack}>
              {infoMessage ? (
                <MessageBanner
                  tone="info"
                  message={infoMessage}
                  surface={withAlpha(authPalette.surface, "1A")}
                  textColor={authPalette.textMuted}
                />
              ) : null}
              {errorMessage ? (
                <MessageBanner
                  tone="danger"
                  message={errorMessage}
                  surface={authPalette.dangerSubtle}
                  textColor={authPalette.danger}
                />
              ) : null}
            </View>

            {!isSwitchAccountFlow ? (
              <Text
                style={[styles.footerText, { color: authPalette.textMuted }]}
              >
                {"No account? Input your email and let's get started."}
              </Text>
            ) : null}
          </View>
        </View>
      </TabScreenScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: "center",
    gap: BrandSpacing.xl,
    paddingTop: BrandSpacing.xxl,
    paddingBottom: BrandSpacing.xxl,
  },
  heroBlock: {
    alignItems: "center",
    gap: BrandSpacing.sm,
    paddingTop: BrandSpacing.xl,
  },
  heroTitle: {
    fontFamily: "Kanit_800ExtraBold",
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  formBlock: {
    gap: BrandSpacing.lg,
  },
  primaryActions: {
    gap: BrandSpacing.sm,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: BrandSpacing.md,
  },
  socialPressable: {
    flex: 1,
  },
  socialButtonCompact: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.sm,
    borderRadius: 14,
    borderWidth: 0,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.md,
  },
  socialCompactLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    lineHeight: 20,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
  },
  dividerLineWide: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: LetterSpacing.trackingWide,
  },
  inputContainerBox: {
    gap: BrandSpacing.sm,
  },
  inputLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    lineHeight: 18,
  },
  inputSurface: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 0,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
  },
  inputIcon: {
    marginLeft: BrandSpacing.xs,
  },
  codeBlock: {
    gap: BrandSpacing.sm,
  },
  codeEmailChip: {
    alignSelf: "center",
    borderRadius: BrandRadius.pill,
    borderWidth: 1,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
  },
  codeEmailText: {
    ...BrandType.caption,
  },
  messageStack: {
    gap: BrandSpacing.sm,
  },
  footerText: {
    textAlign: "center",
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    marginTop: 0,
  },
  emailInput: {
    flex: 1,
    fontFamily: "Manrope_600SemiBold",
    fontSize: FontSize.body,
    fontWeight: 600,
    lineHeight: 22,
    includeFontPadding: false,
    paddingVertical: BrandSpacing.sm,
  },
  codeInput: {
    flex: 1,
    fontFamily: "Lexend_600SemiBold",
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: 10,
    lineHeight: 32,
    textAlign: "center",
    includeFontPadding: false,
    paddingVertical: BrandSpacing.sm,
    fontVariant: ["tabular-nums"],
  },
  auroraFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden",
    transform: [{ translateY: -20 }, { scale: 1.07 }],
  },
});
