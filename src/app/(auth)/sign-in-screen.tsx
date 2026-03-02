import { useAuthActions } from "@convex-dev/auth/react";
import { useHeaderHeight } from "@react-navigation/elements";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { KitButton, KitTextField } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type Step = "email" | "code";

const OTP_LENGTH = 6;

WebBrowser.maybeCompleteAuthSession();

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const searchParams = useLocalSearchParams<{ authFlow?: string | string[]; code?: string | string[] }>();
  const palette = useBrand();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const headerHeight = useHeaderHeight();
  const handledMagicCodeRef = useRef<string | null>(null);

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
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleSendCode = async () => {
    if (isSubmitting) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
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
    if (isSubmitting) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
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
    if (isSubmitting) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await signIn("resend", { email: normalizedEmail, redirectTo: magicLinkRedirectTo });
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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.xl,
          paddingBottom: BrandSpacing.xxl,
          backgroundColor: palette.appBg,
        }}
      >
        <View style={{ flex: 1, gap: BrandSpacing.xl }}>
        <View style={{ gap: BrandSpacing.xs }}>
          <ThemedText type="display">{t("auth.signInTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {t("auth.signInSubtitle")}
          </ThemedText>
        </View>

        <View style={{ gap: BrandSpacing.md }}>
          <KitButton
            label={t("auth.signInWithGoogle")}
            variant="secondary"
            onPress={() => void handleOAuth("google")}
            disabled={isSubmitting}
            icon="person.badge.key.fill"
            style={{ justifyContent: "flex-start" }}
          />
          <KitButton
            label={t("auth.signInWithApple")}
            variant="secondary"
            onPress={() => void handleOAuth("apple")}
            disabled={isSubmitting}
            icon="apple.logo"
            style={{ justifyContent: "flex-start" }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.sm,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
            <ThemedText type="micro" style={{ color: palette.textMuted }}>
              {t("auth.or")}
            </ThemedText>
            <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
          </View>
        </View>

        <View style={{ gap: BrandSpacing.md }}>
          {step === "email" ? (
            <View key="email-step" style={{ gap: BrandSpacing.md }}>
              <KitTextField
                label={t("auth.emailLabel")}
                value={email}
                onChangeText={setEmail}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
              />
              <KitButton
                label={isSubmitting ? t("auth.signingIn") : t("auth.sendCodeButton")}
                onPress={() => void handleSendCode()}
                disabled={isSubmitting || email.trim().length === 0}
              />
              <KitButton
                label={t("auth.sendMagicLinkButton")}
                variant="secondary"
                onPress={() => void handleSendMagicLink()}
                disabled={isSubmitting || email.trim().length === 0}
              />
            </View>
          ) : (
            <View key="code-step" style={{ gap: BrandSpacing.md }}>
              <KitTextField
                label={t("auth.codeLabel")}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
              />
              <KitButton
                label={isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCodeButton")}
                onPress={() => void handleVerifyCode()}
                disabled={isSubmitting || code.length !== OTP_LENGTH}
              />
              <KitButton
                label={t("auth.backToSignInMethods")}
                variant="secondary"
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
              />
            </View>
          )}
        </View>

        {infoMessage ? (
          <ThemedText type="caption" selectable style={{ color: palette.textMuted }}>
            {infoMessage}
          </ThemedText>
        ) : null}

        {errorMessage ? (
          <ThemedText type="caption" selectable style={{ color: palette.danger }}>
            {errorMessage}
          </ThemedText>
        ) : null}

        <View style={{ marginTop: "auto", paddingTop: BrandSpacing.md }}>
          <ThemedText type="caption" style={{ color: palette.textMuted, textAlign: "center" }}>
            {t("auth.noAccountHint")}
          </ThemedText>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
