import { useAuthActions } from "@convex-dev/auth/react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, Redirect, usePathname } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  LinearTransition,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitButton, KitTextField } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type Step = "email" | "code";

const OTP_LENGTH = 6;
const OTP_PILL_WIDTH = 44;
const OTP_SLOTS = Array.from({ length: OTP_LENGTH }, (_, slot) => slot);

WebBrowser.maybeCompleteAuthSession();

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function HeroSymbols({ palette }: { palette: BrandPalette }) {
  const symbols: { name: string; delay: number; rotate: string }[] = [
    { name: "figure.run", delay: 0, rotate: "-12deg" },
    { name: "dumbbell.fill", delay: 80, rotate: "0deg" },
    { name: "figure.yoga", delay: 160, rotate: "10deg" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: BrandSpacing.xl,
        height: 96,
      }}
    >
      {symbols.map((s, i) => (
        <Animated.View
          key={String(s.name)}
          entering={FadeIn.delay(s.delay).duration(500).springify().damping(18)}
          style={{ transform: [{ rotate: s.rotate }] }}
        >
          <AppSymbol
            name={s.name}
            size={i === 1 ? 48 : 36}
            tintColor={i === 1 ? palette.primary : palette.textMicro}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function StepProgress({
  step,
  palette,
  emailLabel,
  codeLabel,
}: {
  step: Step;
  palette: BrandPalette;
  emailLabel: string;
  codeLabel: string;
}) {
  const isEmail = step === "email";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: BrandRadius.pill,
          backgroundColor: isEmail ? palette.primary : palette.border,
        }}
      />
      <ThemedText type="micro" style={{ color: isEmail ? palette.text : palette.textMuted }}>
        {emailLabel}
      </ThemedText>
      <View style={{ width: 22, height: 1, backgroundColor: palette.border }} />
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: BrandRadius.pill,
          backgroundColor: !isEmail ? palette.primary : palette.border,
        }}
      />
      <ThemedText type="micro" style={{ color: !isEmail ? palette.text : palette.textMuted }}>
        {codeLabel}
      </ThemedText>
    </View>
  );
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isSignUpRoute = pathname === "/sign-up";
  const palette = useBrand();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const codeInputRef = useRef<TextInput | null>(null);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "code") return;
    const timeout = setTimeout(() => {
      codeInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timeout);
  }, [step]);

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  const handleSendCode = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await signIn("resend-otp", { email: email.trim() });
      setStep("code");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await signIn("resend-otp", { email: email.trim(), code: code.trim() });
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
    try {
      const redirectTo = AuthSession.makeRedirectUri({ path: "sign-in" });
      const started = await signIn(provider, { redirectTo });
      if (!started.redirect) return;
      const oauthResult = await WebBrowser.openAuthSessionAsync(
        started.redirect.toString(),
        redirectTo,
      );
      if (oauthResult.type !== "success" || !oauthResult.url) return;
      const url = new URL(oauthResult.url);
      const oauthCode = url.searchParams.get("code");
      if (!oauthCode) {
        setErrorMessage(t("auth.oauthFailed"));
        return;
      }
      await signIn(provider, { code: oauthCode, redirectTo });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: BrandSpacing.lg,
        paddingTop: BrandSpacing.xl,
        paddingBottom: BrandSpacing.lg,
        backgroundColor: palette.appBg,
      }}
    >
      <View style={{ flex: 1, gap: BrandSpacing.xl }}>
        <Animated.View entering={FadeIn.duration(500)} style={{ gap: BrandSpacing.md }}>
          <HeroSymbols palette={palette} />
          <View style={{ gap: BrandSpacing.xs }}>
            <ThemedText type="display">
              {isSignUpRoute ? t("auth.signUpTitle") : t("auth.signInTitle")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {isSignUpRoute ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}
            </ThemedText>
          </View>
          <StepProgress
            step={step}
            palette={palette}
            emailLabel={t("auth.emailLabel")}
            codeLabel={t("auth.codeLabel")}
          />
        </Animated.View>

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

        <Animated.View
          layout={LinearTransition.springify()}
          style={{
            gap: BrandSpacing.md,
            paddingTop: BrandSpacing.sm,
            paddingBottom: BrandSpacing.xs,
          }}
        >
          {step === "email" ? (
            <Animated.View
              key="email-step"
              entering={FadeInRight.duration(280).springify()}
              exiting={FadeOutLeft.duration(200)}
              style={{ gap: BrandSpacing.md }}
            >
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
                disabled={isSubmitting}
              />
            </Animated.View>
          ) : (
            <Animated.View
              key="code-step"
              entering={FadeInRight.duration(280).springify()}
              exiting={FadeOutLeft.duration(200)}
              style={{ gap: BrandSpacing.md }}
            >
              <ThemedText type="bodyStrong">{t("auth.codeLabel")}</ThemedText>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: BrandSpacing.sm,
                  position: "relative",
                }}
              >
                <TextInput
                  ref={codeInputRef}
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
                  style={{
                    position: "absolute",
                    opacity: Platform.OS === "web" ? 0.01 : 0,
                    width: 1,
                    height: 1,
                  }}
                />
                {OTP_SLOTS.map((slot) => {
                  const digit = code[slot] ?? "";
                  const isActive = code.length === slot;
                  return (
                    <Pressable
                      key={`otp-slot-${slot}`}
                      onPress={() => codeInputRef.current?.focus()}
                      onPressIn={() => codeInputRef.current?.focus()}
                      style={{ width: OTP_PILL_WIDTH, height: 56 }}
                    >
                      <Animated.View
                        entering={FadeIn.delay(slot * 40).duration(200)}
                        style={{
                          width: OTP_PILL_WIDTH,
                          height: 56,
                          borderWidth: isActive ? 2 : 1.5,
                          borderRadius: BrandRadius.input,
                          borderCurve: "continuous",
                          borderColor: isActive ? palette.primary : palette.border,
                          backgroundColor: isActive ? palette.primarySubtle : palette.surface,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ThemedText type="heading" style={{ fontSize: 22 }}>
                          {digit || " "}
                        </ThemedText>
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </View>
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
            </Animated.View>
          )}
        </Animated.View>

        {errorMessage ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <ThemedText type="caption" selectable style={{ color: palette.danger }}>
              {errorMessage}
            </ThemedText>
          </Animated.View>
        ) : null}

        <View style={{ marginTop: "auto", paddingTop: BrandSpacing.sm }}>
          <Link href={isSignUpRoute ? "/sign-in" : "/sign-up"} asChild>
            <Animated.Text
              entering={FadeIn.duration(400).delay(200)}
              style={{ color: palette.primary, textAlign: "center" }}
            >
              {isSignUpRoute ? t("auth.goToSignIn") : t("auth.goToSignUp")}
            </Animated.Text>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
