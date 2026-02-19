import { useAuth, useSignUp, useSSO } from "@clerk/clerk-expo";
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
import { omitUndefined } from "@/lib/omit-undefined";

type SignUpMethod = "email_code" | "phone_code";
type VerificationTarget = "email" | "phone" | null;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];

  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [method, setMethod] = useState<SignUpMethod>("email_code");
  const [emailAddress, setEmailAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationTarget, setVerificationTarget] =
    useState<VerificationTarget>(null);
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

  const handleCreateAccount = async () => {
    if (!isLoaded || !signUp || !setActive || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (method === "email_code") {
        const optionalPhoneNumber = phoneNumber.trim() || undefined;
        await signUp.create({
          emailAddress: emailAddress.trim(),
          password,
          ...omitUndefined({ phoneNumber: optionalPhoneNumber }),
        });

        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setVerificationTarget("email");
        return;
      }

      const optionalEmailAddress = emailAddress.trim() || undefined;
      await signUp.create({
        phoneNumber: phoneNumber.trim(),
        password,
        ...omitUndefined({ emailAddress: optionalEmailAddress }),
      });

      await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
      setVerificationTarget("phone");
    } catch (error) {
      setErrorMessage(getClerkErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp || !setActive || isSubmitting || !verificationTarget)
      return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result =
        verificationTarget === "email"
          ? await signUp.attemptEmailAddressVerification({
              code: code.trim(),
            })
          : await signUp.attemptPhoneNumberVerification({
              code: code.trim(),
            });

      if (result.status === "complete") {
        await activateSession(result.createdSessionId);
        return;
      }

      if (
        result.status === "missing_requirements" &&
        Array.isArray(result.missingFields) &&
        result.missingFields.includes("phone_number")
      ) {
        setErrorMessage(t("auth.phoneNumberRequiredForSignUp"));
        setVerificationTarget(null);
        setMethod("phone_code");
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

  const methodChip = (value: SignUpMethod, label: string) => {
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
          setVerificationTarget(null);
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
          <ThemedText type="title">{t("auth.signUpTitle")}</ThemedText>
          <ThemedText style={{ color: palette.textMuted }}>
            {t("auth.signUpSubtitle")}
          </ThemedText>
        </View>

        <BrandSurface tone="elevated">
          <BrandButton
            label={t("auth.signUpWithGoogle")}
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

          {!verificationTarget ? (
            <>
              <View style={styles.methodRow}>
                {methodChip("email_code", t("auth.methodEmailCode"))}
                {methodChip("phone_code", t("auth.methodPhoneCode"))}
              </View>

              <ThemedText type="defaultSemiBold">{t("auth.emailLabel")}</ThemedText>
              <TextInput
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t("auth.emailPlaceholder")}
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

              <ThemedText type="defaultSemiBold">
                {t("auth.phoneNumberLabel")}
              </ThemedText>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
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

              <ThemedText type="defaultSemiBold">
                {t("auth.passwordLabel")}
              </ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
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

              {method === "email_code" ? (
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("auth.magicLinkUnavailableNative")}
                </ThemedText>
              ) : null}

              <BrandButton
                label={
                  isSubmitting
                    ? t("auth.creatingAccount")
                    : t("auth.createAccountButton")
                }
                onPress={() => {
                  void handleCreateAccount();
                }}
                disabled={isSubmitting}
              />
            </>
          ) : (
            <>
              <ThemedText type="defaultSemiBold">
                {verificationTarget === "phone"
                  ? t("auth.phoneCodeLabel")
                  : t("auth.codeLabel")}
              </ThemedText>
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
                  void handleVerify();
                }}
                disabled={isSubmitting}
              />

              <BrandButton
                label={t("auth.backToSignUpDetails")}
                variant="secondary"
                onPress={() => {
                  setVerificationTarget(null);
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

          <Link href="/sign-in" asChild>
            <Pressable style={styles.linkWrap}>
              <ThemedText type="link">{t("auth.goToSignIn")}</ThemedText>
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
