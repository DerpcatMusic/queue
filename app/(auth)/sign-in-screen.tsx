import { useAuthActions } from "@convex-dev/auth/react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useRef, useState } from "react";
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
import {
  ExpressiveButton,
  ExpressiveSurface,
  ExpressiveTextField,
} from "@/components/ui/expressive";
import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Step = "email" | "code";
const OTP_LENGTH = 6;

WebBrowser.maybeCompleteAuthSession();

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
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
      await signIn("resend-otp", {
        email: email.trim(),
        code: code.trim(),
      });
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

      if (!started.redirect) {
        return;
      }

      const oauthResult = await WebBrowser.openAuthSessionAsync(
        started.redirect.toString(),
        redirectTo,
      );

      if (oauthResult.type !== "success" || !oauthResult.url) {
        return;
      }

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

        <ExpressiveSurface tone="glass">
          <ExpressiveButton
            label={t("auth.signInWithGoogle")}
            variant="secondary"
            onPress={() => {
              void handleOAuth("google");
            }}
            disabled={isSubmitting}
            style={styles.oauthButton}
            leadingIcon={
              <MaterialIcons name="g-mobiledata" size={28} color={palette.primary} />
            }
          />

          <ExpressiveButton
            label={t("auth.signInWithApple")}
            variant="secondary"
            onPress={() => {
              void handleOAuth("apple");
            }}
            disabled={isSubmitting}
            leadingIcon={
              <MaterialIcons name="apple" size={20} color={palette.text} />
            }
          />

          <View style={styles.separatorRow}>
            <View style={[styles.separatorLine, { backgroundColor: palette.border }]} />
            <ThemedText style={{ color: palette.textMuted }}>
              {t("auth.or")}
            </ThemedText>
            <View style={[styles.separatorLine, { backgroundColor: palette.border }]} />
          </View>

          {step === "email" ? (
            <>
              <ExpressiveTextField
                label={t("auth.emailLabel")}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
              />

              <ExpressiveButton
                label={isSubmitting ? t("auth.signingIn") : t("auth.sendCodeButton")}
                onPress={() => {
                  void handleSendCode();
                }}
                disabled={isSubmitting}
              />
            </>
          ) : (
            <>
              <ThemedText type="defaultSemiBold">{t("auth.codeLabel")}</ThemedText>
              <Pressable
                onPress={() => codeInputRef.current?.focus()}
                style={styles.otpWrap}
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
                  style={styles.hiddenOtpInput}
                />
                {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                  const digit = code[index] ?? "";
                  const isActive = code.length === index;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.otpPill,
                        {
                          borderColor: isActive ? palette.primary : palette.border,
                          backgroundColor: palette.surface,
                        },
                      ]}
                    >
                      <ThemedText type="defaultSemiBold">{digit || " "}</ThemedText>
                    </View>
                  );
                })}
              </Pressable>

              <ExpressiveButton
                label={isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCodeButton")}
                onPress={() => {
                  void handleVerifyCode();
                }}
                disabled={isSubmitting || code.length !== OTP_LENGTH}
              />

              <ExpressiveButton
                label={t("auth.backToSignInMethods")}
                variant="secondary"
                onPress={() => {
                  setStep("email");
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
        </ExpressiveSurface>
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
  oauthButton: {
    justifyContent: "flex-start",
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
  otpWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    position: "relative",
  },
  hiddenOtpInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpPill: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  linkWrap: {
    alignItems: "center",
    paddingTop: 4,
  },
});
