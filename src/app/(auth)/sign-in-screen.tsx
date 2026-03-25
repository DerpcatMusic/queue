import { useAuthActions } from "@convex-dev/auth/react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useConvexAuth } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import { SheetHeaderBlock } from "@/components/ui/sheet-header-block";
import { type BrandPalette, BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import {
  canUseNativeGoogleAuth,
  resolveGoogleNativeAuthConfig,
  signInWithGoogleNative,
} from "@/lib/google-auth-native";
import {
  consumePendingPostSignOutAuthHandoff,
  type PostSignOutAuthIntent,
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

function MessageBanner({
  tone,
  message,
  palette,
}: {
  tone: "info" | "danger";
  message: string;
  palette: BrandPalette;
}) {
  const backgroundColor =
    tone === "danger" ? (palette.dangerSubtle as string) : (palette.surfaceAlt as string);
  const textColor = tone === "danger" ? (palette.danger as string) : (palette.textMuted as string);

  return (
    <View className="rounded-medium px-md py-sm" style={{ backgroundColor }}>
      <Text
        selectable
        className="text-sm"
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
  const { t } = useTranslation();
  const searchParams = useLocalSearchParams<{
    authFlow?: string | string[];
    code?: string | string[];
    email?: string | string[];
    intent?: string | string[];
  }>();
  const palette = useBrand();
  const { contentContainerStyle: sheetContentInsets } = useTopSheetContentInsets({
    topSpacing: BrandSpacing.lg,
    bottomSpacing: BrandSpacing.xxl,
    horizontalPadding: BrandSpacing.lg,
  });
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const googleNativeAuthConfig = useMemo(resolveGoogleNativeAuthConfig, []);
  const handledMagicCodeRef = useRef<string | null>(null);
  const pendingAuthHandoffRef = useRef(consumePendingPostSignOutAuthHandoff());

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
  const isSignUpIntent = authIntent === "sign-up";
  const sheetTitle =
    step === "code"
      ? t("auth.verifyCodeButton")
      : isSignUpIntent
        ? t("auth.signUpTitle")
        : t("auth.navigation.signIn");
  const sheetSubtitle =
    step === "code"
      ? t("auth.codeSheetSubtitle")
      : isSignUpIntent
        ? t("auth.signUpSubtitle")
        : t("auth.sheetSubtitle");

  const signInSheetConfig = useMemo(
    () => ({
      stickyHeader: <SheetHeaderBlock title={sheetTitle} subtitle={sheetSubtitle} tone="surface" />,
      backgroundColor: palette.surface as string,
      topInsetColor: palette.surface as string,
      padding: {
        horizontal: BrandSpacing.lg,
        vertical: BrandSpacing.sm,
      },
      steps: [step === "code" ? 0.22 : 0.2],
      initialStep: 0,
    }),
    [isSignUpIntent, palette, sheetSubtitle, sheetTitle, step],
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

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  const normalizedEmail = email.trim();
  const isEmailReady = normalizedEmail.length > 0;

  const handleSendCode = async () => {
    if (isSubmitting || !isEmailReady) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await signIn("resend-otp", { email: normalizedEmail });
      setStep("code");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (isSubmitting || !isEmailReady) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await signIn("resend-otp", { email: normalizedEmail, code: code.trim() });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (isSubmitting || !isEmailReady) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
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
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      if (provider === "google" && canUseNativeGoogleAuth(googleNativeAuthConfig)) {
        const nativeGoogleConfig = googleNativeAuthConfig;
        const nativeResult = await signInWithGoogleNative({
          config: nativeGoogleConfig,
          ...(normalizedEmail ? { loginHint: normalizedEmail } : {}),
        });
        if (nativeResult.type === "cancelled") {
          setErrorMessage(t("auth.oauthCancelled"));
          return;
        }

        await signIn("google-native", { idToken: nativeResult.idToken });
        return;
      }

      const started = await signIn(provider, { redirectTo: oauthRedirectTo });
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
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          ...(sheetContentInsets as object),
        }}
      >
        <View className="flex-1 justify-between gap-6">
          <View className="gap-4">
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
              leading={<FontAwesome5 name="at" size={16} color={palette.textMuted as string} />}
              style={styles.emailInput}
            />

            {step === "email" ? (
              <>
                <View className="flex-row gap-stack-tight">
                  <View className="flex-1">
                    <ActionButton
                      label={isSubmitting ? t("auth.signingIn") : t("auth.sendCodeButton")}
                      onPress={() => {
                        void handleSendCode();
                      }}
                      disabled={isSubmitting || !isEmailReady}
                      palette={palette}
                      fullWidth
                      size="lg"
                    />
                  </View>
                  <View className="flex-1">
                    <ActionButton
                      label={t("auth.sendMagicLinkButton")}
                      onPress={() => {
                        void handleSendMagicLink();
                      }}
                      disabled={isSubmitting || !isEmailReady}
                      palette={palette}
                      tone="secondary"
                      fullWidth
                      size="lg"
                    />
                  </View>
                </View>

                <View className="flex-row items-center gap-stack-tight py-xs">
                  <View
                    className="flex-1 h-px"
                    style={{ backgroundColor: palette.border as string }}
                  />
                  <Text
                    className="uppercase"
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.7,
                    }}
                  >
                    {t("auth.or")}
                  </Text>
                  <View
                    className="flex-1 h-px"
                    style={{ backgroundColor: palette.border as string }}
                  />
                </View>

                <View className="flex-row items-stretch justify-center gap-stack">
                  <IconButton
                    accessibilityLabel={
                      isSignUpIntent ? t("auth.signUpWithGoogle") : t("auth.signInWithGoogle")
                    }
                    icon={<FontAwesome5 name="google" size={26} color={palette.danger as string} />}
                    onPress={() => {
                      void handleOAuth("google");
                    }}
                    disabled={isSubmitting}
                  />
                  <IconButton
                    accessibilityLabel={t("auth.signInWithApple")}
                    icon={<FontAwesome5 name="apple" size={30} color={palette.text as string} />}
                    onPress={() => {
                      void handleOAuth("apple");
                    }}
                    disabled={isSubmitting}
                  />
                </View>
              </>
            ) : (
              <View className="gap-stack-tight">
                <Text
                  className="text-center"
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
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
                <View className="flex-row gap-stack-tight">
                  <View className="flex-1">
                    <ActionButton
                      label={isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCodeButton")}
                      onPress={() => {
                        void handleVerifyCode();
                      }}
                      disabled={isSubmitting || code.length !== OTP_LENGTH}
                      palette={palette}
                      fullWidth
                      size="lg"
                    />
                  </View>
                  <View className="flex-1">
                    <ActionButton
                      label={t("auth.backToSignInMethods")}
                      onPress={() => {
                        setStep("email");
                        setCode("");
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      disabled={isSubmitting}
                      palette={palette}
                      tone="secondary"
                      fullWidth
                      size="lg"
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          <View className="gap-stack-tight">
            {infoMessage ? (
              <MessageBanner tone="info" message={infoMessage} palette={palette} />
            ) : null}
            {errorMessage ? (
              <MessageBanner tone="danger" message={errorMessage} palette={palette} />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  emailInput: {
    ...BrandType.bodyMedium,
    includeFontPadding: false,
  },
  codeInput: {
    ...BrandType.heading,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 10,
    textAlign: "center",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
});
