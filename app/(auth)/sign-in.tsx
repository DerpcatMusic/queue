import { useAuth, useSignIn, useSSO } from "@clerk/clerk-expo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as AuthSession from "expo-auth-session";
import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { BrandButton } from "@/components/ui/brand-button";
import { BrandSurface } from "@/components/ui/brand-surface";
import { Brand, BrandRadius } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getClerkErrorMessage } from "@/lib/clerk-errors";

type SignInMethod = "password" | "email_code" | "phone_code";
type VerificationFlow =
  | "first_factor_email_code"
  | "first_factor_phone_code"
  | "second_factor_email_code"
  | "second_factor_phone_code"
  | null;

type UseSignInResult = ReturnType<typeof useSignIn>;
type SignInResource = NonNullable<UseSignInResult["signIn"]>;
type SignInCreateResult = Awaited<ReturnType<SignInResource["create"]>>;
type SignInFirstFactor = NonNullable<SignInCreateResult["supportedFirstFactors"]>[number];
type SignInSecondFactor = NonNullable<SignInResource["supportedSecondFactors"]>[number];

const isEmailCodeSecondFactor = (
  factor: SignInSecondFactor,
): factor is Extract<SignInSecondFactor, { strategy: "email_code" }> =>
  factor.strategy === "email_code";

const isPhoneCodeSecondFactor = (
  factor: SignInSecondFactor,
): factor is Extract<SignInSecondFactor, { strategy: "phone_code" }> =>
  factor.strategy === "phone_code";

const isEmailCodeFirstFactor = (
  factor: SignInFirstFactor,
): factor is Extract<SignInFirstFactor, { strategy: "email_code" }> =>
  factor.strategy === "email_code";

const isPhoneCodeFirstFactor = (
  factor: SignInFirstFactor,
): factor is Extract<SignInFirstFactor, { strategy: "phone_code" }> =>
  factor.strategy === "phone_code";

export default function SignInScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];

  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [method, setMethod] = useState<SignInMethod>("password");
  const [identifier, setIdentifier] = useState("");
  const [phoneIdentifier, setPhoneIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationFlow, setVerificationFlow] =
    useState<VerificationFlow>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isAuthLoaded && isSignedIn) {
    return <Redirect href="/" />;
  }

  const activateSession = async (sessionId: string | null) => {
    if (!sessionId) {
      setErrorMessage(t("auth.sessionActivationFailed"));
      return;
    }

    if (!setActive) {
      setErrorMessage(t("auth.sessionActivationFailed"));
      return;
    }

    await setActive({
      session: sessionId,
      navigate: async ({ session }) => {
        if (session?.currentTask) {
          const taskKey =
            typeof session.currentTask === "object" &&
            "key" in session.currentTask
              ? String(session.currentTask.key)
              : "unknown";
          setErrorMessage(t("auth.sessionTaskPending", { task: taskKey }));
          return;
        }
        router.replace("/");
      },
    });
  };

  const beginSecondFactor = async () => {
    if (!signIn) return false;

    const emailFactor = signIn.supportedSecondFactors?.find(
      isEmailCodeSecondFactor,
    );

    if (emailFactor?.emailAddressId) {
      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      setVerificationFlow("second_factor_email_code");
      return true;
    }

    const phoneFactor = signIn.supportedSecondFactors?.find(
      isPhoneCodeSecondFactor,
    );

    if (phoneFactor?.phoneNumberId) {
      await signIn.prepareSecondFactor({
        strategy: "phone_code",
        phoneNumberId: phoneFactor.phoneNumberId,
      });
      setVerificationFlow("second_factor_phone_code");
      return true;
    }

    return false;
  };

  const handlePrimarySignIn = async () => {
    if (!isLoaded || !signIn || !setActive || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (method === "password") {
        const result = await signIn.create({
          strategy: "password",
          identifier: identifier.trim(),
          password,
        });

        if (result.status === "complete") {
          await activateSession(result.createdSessionId);
          return;
        }

        if (result.status === "needs_second_factor") {
          const started = await beginSecondFactor();
          if (!started) {
            setErrorMessage(t("auth.secondFactorUnavailable"));
          }
          return;
        }

        setErrorMessage(
          t("auth.additionalStepRequiredWithStatus", {
            status: result.status ?? "unknown",
          }),
        );
        return;
      }

      if (method === "email_code") {
        const result = await signIn.create({
          strategy: "email_code",
          identifier: identifier.trim(),
        });

        if (result.status === "complete") {
          await activateSession(result.createdSessionId);
          return;
        }

        const emailFactor = result.supportedFirstFactors?.find(
          isEmailCodeFirstFactor,
        );

        if (emailFactor?.emailAddressId) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor.emailAddressId,
          });
          setVerificationFlow("first_factor_email_code");
          return;
        }

        setErrorMessage(t("auth.additionalStepRequired"));
        return;
      }

      const result = await signIn.create({
        strategy: "phone_code",
        identifier: phoneIdentifier.trim(),
      });

      if (result.status === "complete") {
        await activateSession(result.createdSessionId);
        return;
      }

      const phoneFactor = result.supportedFirstFactors?.find(
        isPhoneCodeFirstFactor,
      );

      if (phoneFactor?.phoneNumberId) {
        await signIn.prepareFirstFactor({
          strategy: "phone_code",
          phoneNumberId: phoneFactor.phoneNumberId,
        });
        setVerificationFlow("first_factor_phone_code");
        return;
      }

      setErrorMessage(t("auth.additionalStepRequired"));
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeVerification = async () => {
    if (!isLoaded || !signIn || !setActive || isSubmitting || !verificationFlow)
      return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const normalizedCode = code.trim();
      const result = verificationFlow.startsWith("first_factor")
        ? await signIn.attemptFirstFactor({
            strategy:
              verificationFlow === "first_factor_phone_code"
                ? "phone_code"
                : "email_code",
            code: normalizedCode,
          })
        : await signIn.attemptSecondFactor({
            strategy:
              verificationFlow === "second_factor_phone_code"
                ? "phone_code"
                : "email_code",
            code: normalizedCode,
          });

      if (result.status === "complete") {
        await activateSession(result.createdSessionId);
        return;
      }

      setErrorMessage(
        t("auth.additionalStepRequiredWithStatus", {
          status: result.status ?? "unknown",
        }),
      );
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGooglePress = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        path: "sso-callback",
      });

      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      if (result.createdSessionId) {
        if (result.setActive) {
          await result.setActive({ session: result.createdSessionId });
          router.replace("/");
          return;
        }

        await activateSession(result.createdSessionId);
        return;
      }

      if (result.authSessionResult?.type === "cancel") {
        setErrorMessage(t("auth.oauthCancelled"));
      } else {
        setErrorMessage(t("auth.oauthFailed"));
      }
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const codeLabel =
    verificationFlow === "first_factor_phone_code" ||
    verificationFlow === "second_factor_phone_code"
      ? t("auth.phoneCodeLabel")
      : t("auth.codeLabel");

  const methodChip = (value: SignInMethod, label: string) => {
    const active = method === value;

    return (
      <Pressable
        key={value}
        style={[
          styles.methodChip,
          {
            borderColor: active ? palette.primary : palette.border,
            backgroundColor: active ? palette.primarySubtle : palette.surface,
          },
        ]}
        onPress={() => {
          if (isSubmitting) return;
          setMethod(value);
          setVerificationFlow(null);
          setCode("");
          setErrorMessage(null);
        }}
      >
        <ThemedText
          type="defaultSemiBold"
          style={{ color: active ? palette.primary : palette.textMuted }}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeArea, { backgroundColor: palette.appBg }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBlock}>
          <ThemedText type="title">{t("auth.signInTitle")}</ThemedText>
          <ThemedText style={{ color: palette.textMuted }}>
            {t("auth.signInSubtitle")}
          </ThemedText>
        </View>

        <BrandSurface tone="elevated">
          <BrandButton
            label={t("auth.signInWithGoogle")}
            variant="secondary"
            onPress={() => {
              void handleGooglePress();
            }}
            disabled={isSubmitting}
            style={styles.googleButton}
          />
          <View pointerEvents="none" style={styles.googleIconWrap}>
            <MaterialIcons name="g-mobiledata" size={28} color={palette.primary} />
          </View>

          <View style={styles.separatorRow}>
            <View style={[styles.separatorLine, { backgroundColor: palette.border }]} />
            <ThemedText style={{ color: palette.textMuted }}>
              {t("auth.or")}
            </ThemedText>
            <View style={[styles.separatorLine, { backgroundColor: palette.border }]} />
          </View>

          {!verificationFlow ? (
            <>
              <View style={styles.methodRow}>
                {methodChip("password", t("auth.methodPassword"))}
                {methodChip("email_code", t("auth.methodEmailCode"))}
                {methodChip("phone_code", t("auth.methodPhoneCode"))}
              </View>

              {method === "phone_code" ? (
                <>
                  <ThemedText type="defaultSemiBold">
                    {t("auth.phoneNumberLabel")}
                  </ThemedText>
                  <TextInput
                    value={phoneIdentifier}
                    onChangeText={setPhoneIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    placeholder={t("auth.phoneNumberPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    style={[
                      styles.input,
                      {
                        borderColor: palette.border,
                        color: palette.text,
                        backgroundColor: palette.surface,
                      },
                    ]}
                  />
                </>
              ) : (
                <>
                  <ThemedText type="defaultSemiBold">
                    {t("auth.identifierLabel")}
                  </ThemedText>
                  <TextInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="username"
                    placeholder={t("auth.identifierPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    style={[
                      styles.input,
                      {
                        borderColor: palette.border,
                        color: palette.text,
                        backgroundColor: palette.surface,
                      },
                    ]}
                  />
                </>
              )}

              {method === "password" ? (
                <>
                  <ThemedText type="defaultSemiBold">
                    {t("auth.passwordLabel")}
                  </ThemedText>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="password"
                    placeholder={t("auth.passwordPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    style={[
                      styles.input,
                      {
                        borderColor: palette.border,
                        color: palette.text,
                        backgroundColor: palette.surface,
                      },
                    ]}
                  />
                </>
              ) : null}

              {method === "email_code" ? (
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("auth.magicLinkUnavailableNative")}
                </ThemedText>
              ) : null}

              <BrandButton
                label={
                  isSubmitting
                    ? t("auth.signingIn")
                    : method === "password"
                      ? t("auth.signInButton")
                      : t("auth.sendCodeButton")
                }
                onPress={() => {
                  void handlePrimarySignIn();
                }}
                disabled={isSubmitting}
              />
            </>
          ) : (
            <>
              <ThemedText type="defaultSemiBold">{codeLabel}</ThemedText>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                placeholder={t("auth.codePlaceholder")}
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: palette.border,
                    color: palette.text,
                    backgroundColor: palette.surface,
                  },
                ]}
              />

              <BrandButton
                label={
                  isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCodeButton")
                }
                onPress={() => {
                  void handleCodeVerification();
                }}
                disabled={isSubmitting}
              />

              <BrandButton
                label={t("auth.backToSignInMethods")}
                variant="secondary"
                onPress={() => {
                  setVerificationFlow(null);
                  setCode("");
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
              />
            </>
          )}

          {errorMessage ? (
            <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
          ) : null}

          <Link href="/sign-up" asChild>
            <Pressable style={styles.linkWrap}>
              <ThemedText type="link">{t("auth.goToSignUp")}</ThemedText>
            </Pressable>
          </Link>
        </BrandSurface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    gap: 14,
  },
  headerBlock: {
    gap: 6,
  },
  googleButton: {
    paddingLeft: 44,
  },
  googleIconWrap: {
    position: "absolute",
    left: 14,
    top: 14,
  },
  separatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 2,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  methodRow: {
    flexDirection: "row",
    gap: 8,
  },
  methodChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: BrandRadius.input,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  linkWrap: {
    alignItems: "center",
    paddingTop: 4,
  },
});
