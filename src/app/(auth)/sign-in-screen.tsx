import { useAuthActions } from "@convex-dev/auth/react";
import { useHeaderHeight } from "@react-navigation/elements";
import { useConvexAuth } from "convex/react";
import * as AuthSession from "expo-auth-session";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ActionButton } from "@/components/ui/action-button";
import {
  BrandRadius,
  BrandSpacing,
  BrandType,
  type BrandPalette,
} from "@/constants/brand";
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

function AuthSignal({
  icon,
  label,
  palette,
}: {
  icon: "building.2.fill" | "person.3.sequence.fill";
  label: string;
  palette: BrandPalette;
}) {
  return (
    <View
      style={[
        styles.signalTile,
        {
          backgroundColor: palette.surfaceElevated as string,
        },
      ]}
    >
      <View
        style={[
          styles.signalIconWrap,
          { backgroundColor: palette.primarySubtle as string },
        ]}
      >
        <IconSymbol
          name={icon}
          size={16}
          color={palette.primary as string}
        />
      </View>
      <Text
        style={{
          ...BrandType.bodyMedium,
          color: palette.text as string,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  palette,
  placeholder,
  helperText,
  autoFocus,
  keyboardType,
  textContentType,
  autoComplete,
  inputMode,
  maxLength,
  returnKeyType,
  center,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  palette: BrandPalette;
  placeholder?: string;
  helperText?: string;
  autoFocus?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
  textContentType?: "emailAddress" | "oneTimeCode";
  autoComplete?: "email" | "one-time-code";
  inputMode?: "text" | "numeric" | "email";
  maxLength?: number;
  returnKeyType?: "done" | "go" | "next" | "search" | "send";
  center?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          ...BrandType.micro,
          color: palette.textMuted as string,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.fieldShell,
          {
            borderColor: palette.border as string,
            backgroundColor: palette.surfaceElevated as string,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode={center ? "never" : "while-editing"}
          selectionColor={palette.primary as string}
          cursorColor={palette.primary as string}
          returnKeyType={returnKeyType}
          style={[
            styles.fieldInput,
            {
              color: palette.text as string,
              textAlign: center ? "center" : "left",
            },
            center
              ? {
                  ...BrandType.heading,
                  letterSpacing: 8,
                }
              : null,
          ]}
        />
      </View>
      {helperText ? (
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
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
    tone === "danger"
      ? (palette.dangerSubtle as string)
      : (palette.surfaceAlt as string);
  const borderColor =
    tone === "danger"
      ? (palette.danger as string)
      : (palette.border as string);
  const textColor =
    tone === "danger"
      ? (palette.danger as string)
      : (palette.textMuted as string);

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor,
          borderColor,
        },
      ]}
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

function ProviderButton({
  label,
  icon,
  onPress,
  disabled,
  palette,
}: {
  label: string;
  icon: "sparkles" | "person.crop.circle.fill";
  onPress: () => void;
  disabled: boolean;
  palette: BrandPalette;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerButton,
        {
          borderColor: palette.border as string,
          backgroundColor: palette.surfaceElevated as string,
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.providerIconWrap,
          { backgroundColor: palette.primarySubtle as string },
        ]}
      >
        <IconSymbol
          name={icon}
          size={16}
          color={palette.primary as string}
        />
      </View>
      <Text
        style={{
          ...BrandType.bodyMedium,
          color: palette.text as string,
        }}
      >
        {label}
      </Text>
      <IconSymbol
        name="arrow.right"
        size={16}
        color={palette.textMuted as string}
      />
    </Pressable>
  );
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const searchParams = useLocalSearchParams<{
    authFlow?: string | string[];
    code?: string | string[];
  }>();
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
      style={{ flex: 1, backgroundColor: palette.appBg as string }}
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
        <View style={styles.screen}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: palette.surfaceAlt as string,
                borderColor: palette.border as string,
              },
            ]}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroCopy}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 0.8,
                  }}
                >
                  {t("auth.navigation.signIn").toUpperCase()}
                </Text>
                <Text
                  style={{
                    ...BrandType.display,
                    color: palette.text as string,
                  }}
                >
                  {t("auth.signInTitle")}
                </Text>
                <Text
                  style={{
                    ...BrandType.body,
                    color: palette.textMuted as string,
                  }}
                >
                  {t("auth.signInSubtitle")}
                </Text>
              </View>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: palette.primarySubtle as string },
                ]}
              >
                <IconSymbol
                  name="sparkles"
                  size={20}
                  color={palette.primary as string}
                />
              </View>
            </View>

            <View style={styles.signalRow}>
              <AuthSignal
                icon="building.2.fill"
                label={t("profile.roles.studio")}
                palette={palette}
              />
              <AuthSignal
                icon="person.3.sequence.fill"
                label={t("profile.roles.instructor")}
                palette={palette}
              />
            </View>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: palette.surface as string,
                borderColor: palette.border as string,
              },
            ]}
          >
            {step === "email" ? (
              <View style={{ gap: BrandSpacing.lg }}>
                <View style={{ gap: 4 }}>
                  <Text
                    style={{
                      ...BrandType.title,
                      color: palette.text as string,
                    }}
                  >
                    {t("auth.sendCodeButton")}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: palette.textMuted as string,
                    }}
                  >
                    {t("auth.signInSubtitle")}
                  </Text>
                </View>

                <AuthField
                  label={t("auth.emailLabel")}
                  value={email}
                  onChangeText={setEmail}
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder={t("auth.emailPlaceholder")}
                  returnKeyType="send"
                  helperText={t("auth.noAccountHint")}
                  palette={palette}
                />

                <View style={{ gap: 10 }}>
                  <ActionButton
                    label={
                      isSubmitting
                        ? t("auth.signingIn")
                        : t("auth.sendCodeButton")
                    }
                    onPress={() => void handleSendCode()}
                    disabled={isSubmitting || email.trim().length === 0}
                    palette={palette}
                    fullWidth
                  />
                  <ActionButton
                    label={t("auth.sendMagicLinkButton")}
                    onPress={() => void handleSendMagicLink()}
                    disabled={isSubmitting || email.trim().length === 0}
                    palette={palette}
                    tone="secondary"
                    fullWidth
                  />
                </View>

                <View style={styles.dividerRow}>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: palette.border as string },
                    ]}
                  />
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("auth.or")}
                  </Text>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: palette.border as string },
                    ]}
                  />
                </View>

                <View style={{ gap: 10 }}>
                  <ProviderButton
                    label={t("auth.signInWithGoogle")}
                    icon="sparkles"
                    onPress={() => {
                      void handleOAuth("google");
                    }}
                    disabled={isSubmitting}
                    palette={palette}
                  />
                  <ProviderButton
                    label={t("auth.signInWithApple")}
                    icon="person.crop.circle.fill"
                    onPress={() => {
                      void handleOAuth("apple");
                    }}
                    disabled={isSubmitting}
                    palette={palette}
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: BrandSpacing.lg }}>
                <View style={{ gap: 4 }}>
                  <Text
                    style={{
                      ...BrandType.title,
                      color: palette.text as string,
                    }}
                  >
                    {t("auth.verifyCodeButton")}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: palette.textMuted as string,
                    }}
                  >
                    {t("auth.magicLinkSent", { email: email.trim() || "..." })}
                  </Text>
                </View>

                <AuthField
                  label={t("auth.codeLabel")}
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
                  placeholder={t("auth.codePlaceholder")}
                  returnKeyType="done"
                  center
                  helperText={t("auth.backToSignInMethods")}
                  palette={palette}
                />

                <View style={{ gap: 10 }}>
                  <ActionButton
                    label={
                      isSubmitting
                        ? t("auth.verifyingCode")
                        : t("auth.verifyCodeButton")
                    }
                    onPress={() => void handleVerifyCode()}
                    disabled={isSubmitting || code.length !== OTP_LENGTH}
                    palette={palette}
                    fullWidth
                  />
                  <ActionButton
                    label={t("auth.backToSignInMethods")}
                    onPress={() => {
                      setStep("email");
                      setCode("");
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    palette={palette}
                    tone="secondary"
                    fullWidth
                  />
                </View>
              </View>
            )}
          </View>

          {infoMessage ? (
            <MessageBanner tone="info" message={infoMessage} palette={palette} />
          ) : null}

          {errorMessage ? (
            <MessageBanner
              tone="danger"
              message={errorMessage}
              palette={palette}
            />
          ) : null}

          <View
            style={[
              styles.footerStrip,
              {
                borderColor: palette.border as string,
                backgroundColor: palette.surfaceAlt as string,
              },
            ]}
          >
            <ThemedText
              type="caption"
              style={{ color: palette.textMuted, textAlign: "center" }}
            >
              {t("auth.noAccountHint")}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: BrandSpacing.lg,
  },
  heroCard: {
    gap: BrandSpacing.lg,
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.xl,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  signalRow: {
    flexDirection: "row",
    gap: 10,
  },
  signalTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: BrandRadius.card - 6,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  signalIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
    gap: BrandSpacing.lg,
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.xl,
  },
  fieldShell: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: BrandRadius.input,
    borderCurve: "continuous",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  fieldInput: {
    minHeight: 52,
    ...BrandType.bodyMedium,
    includeFontPadding: false,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  providerButton: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  providerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerStrip: {
    marginTop: "auto",
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
