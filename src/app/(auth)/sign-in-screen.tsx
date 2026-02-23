import { useAuthActions } from "@convex-dev/auth/react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, Redirect, usePathname } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  TextInput,
  View,
} from "react-native";
import type { SymbolViewProps } from "expo-symbols";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  LinearTransition,
} from "react-native-reanimated";
import { SymbolView } from "expo-symbols";

import { ThemedText } from "@/components/themed-text";
import {
  KitButton,
  KitSurface,
  KitTextField,
} from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";


type Step = "email" | "code";
const OTP_LENGTH = 6;
const OTP_PILL_WIDTH = 44;

WebBrowser.maybeCompleteAuthSession();

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Floating SF Symbol hero icons shown above the sign-in card. */
function HeroSymbols({ palette }: { palette: BrandPalette }) {
  const symbols: {
    name: SymbolViewProps["name"];
    delay: number;
    rotate: string;
  }[] = [
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
        paddingBottom: BrandSpacing.lg,
        height: 100,
      }}
    >
      {symbols.map((s, i) => (
        <Animated.View
          key={String(s.name)}
          entering={FadeIn.delay(s.delay).duration(500).springify().damping(18)}
          style={{ transform: [{ rotate: s.rotate }] }}
        >
          <SymbolView
            name={s.name}
            size={i === 1 ? 48 : 36}
            tintColor={
              i === 1
                ? palette.primary
                : (palette.textMicro as string)
            }
            resizeMode="scaleAspectFit"
          />
        </Animated.View>
      ))}
    </View>
  );
}

function AuthStepPills({
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

  const renderPill = (label: string, selected: boolean) => (
    <View
      key={label}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? palette.primary : palette.border,
        backgroundColor: selected ? palette.primarySubtle : palette.surfaceElevated,
      }}
    >
      <ThemedText type="micro" style={{ color: selected ? palette.primary : palette.textMuted }}>
        {label}
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {renderPill(emailLabel, isEmail)}
      {renderPill(codeLabel, !isEmail)}
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
        paddingVertical: BrandSpacing.xl,
        gap: BrandSpacing.lg,
        backgroundColor: palette.appBg,
      }}
    >
      {/* Brand hero */}
      <Animated.View
        entering={FadeIn.duration(500)}
        style={{ alignItems: "center", gap: BrandSpacing.sm }}
      >
        <HeroSymbols palette={palette} />
        <ThemedText type="heading" style={{ textAlign: "center" }}>
          {isSignUpRoute ? t("auth.signUpTitle") : t("auth.signInTitle")}
        </ThemedText>
        <ThemedText
          type="caption"
          style={{ textAlign: "center", color: palette.textMuted }}
        >
          {isSignUpRoute ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}
        </ThemedText>
        <AuthStepPills
          step={step}
          palette={palette}
          emailLabel={t("auth.emailLabel")}
          codeLabel={t("auth.codeLabel")}
        />
      </Animated.View>

      {/* Auth card */}
      <KitSurface tone="glass" gap={BrandSpacing.md}>
        <View style={{ gap: 2 }}>
          <ThemedText type="defaultSemiBold">
            {step === "email" ? t("auth.sendCodeButton") : t("auth.verifyCodeButton")}
          </ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {step === "email" ? t("auth.emailPlaceholder") : t("auth.codePlaceholder")}
          </ThemedText>
        </View>

        {/* OAuth buttons */}
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

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BrandSpacing.sm,
            marginVertical: 2,
          }}
        >
          <View
            style={{ flex: 1, height: 1, backgroundColor: palette.border }}
          />
          <ThemedText type="micro" style={{ color: palette.textMuted }}>
            {t("auth.or")}
          </ThemedText>
          <View
            style={{ flex: 1, height: 1, backgroundColor: palette.border }}
          />
        </View>

        {/* Step content with animated transition */}
        <Animated.View layout={LinearTransition.springify()}>
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
                label={
                  isSubmitting ? t("auth.signingIn") : t("auth.sendCodeButton")
                }
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

              {/* OTP pills with fixed width (not flex:1) to prevent landscape stretch */}
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
                  onChangeText={(value) =>
                    setCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={OTP_LENGTH}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 1,
                    height: 1,
                  }}
                />
                {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                  const digit = code[index] ?? "";
                  const isActive = code.length === index;
                  return (
                    <Animated.View
                      key={index}
                      entering={FadeIn.delay(index * 40).duration(200)}
                      onTouchEnd={() => codeInputRef.current?.focus()}
                      style={{
                        width: OTP_PILL_WIDTH,
                        height: 56,
                        borderWidth: 1.5,
                        borderRadius: BrandRadius.input,
                        borderCurve: "continuous",
                        borderColor: isActive
                          ? palette.primary
                          : palette.border,
                        backgroundColor: isActive
                          ? palette.primarySubtle
                          : palette.surface,
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: isActive
                          ? "0 0 0 3px rgba(10, 132, 255, 0.18)"
                          : undefined,
                      }}
                    >
                      <ThemedText type="heading" style={{ fontSize: 22 }}>
                        {digit || " "}
                      </ThemedText>
                    </Animated.View>
                  );
                })}
              </View>

              <KitButton
                label={
                  isSubmitting
                    ? t("auth.verifyingCode")
                    : t("auth.verifyCodeButton")
                }
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
            <ThemedText
              type="caption"
              selectable
              style={{ color: palette.danger }}
            >
              {errorMessage}
            </ThemedText>
          </Animated.View>
        ) : null}

        <Link href={isSignUpRoute ? "/sign-in" : "/sign-up"} asChild>
          <Animated.Text
            entering={FadeIn.duration(400).delay(200)}
            style={{
              ...BrandType.caption,
              color: palette.primary,
              textAlign: "center",
              paddingTop: BrandSpacing.xs,
            }}
          >
            {isSignUpRoute ? t("auth.goToSignIn") : t("auth.goToSignUp")}
          </Animated.Text>
        </Link>
      </KitSurface>
    </ScrollView>
  );
}

