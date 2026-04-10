/**
 * Studio Add Account Sheet - add another account to this device.
 */

import { useAuthActions } from "@convex-dev/auth/react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useConvexAuth } from "convex/react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import { BrandSpacing } from "@/constants/brand";
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
  clearPendingPostSignOutAuthIntent,
  type PostSignOutAuthMethod,
  peekPendingPostSignOutAuthHandoff,
  setPendingPostSignOutAuthHandoff,
} from "@/modules/session/post-signout-auth-intent";
import { Text } from "@/primitives";
import { BaseProfileSheet } from "../base-profile-sheet";

type Step = "email" | "code";

const OTP_LENGTH = 6;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

interface StudioAddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function StudioAddAccountSheet({ visible, onClose }: StudioAddAccountSheetProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const { currentUser } = useUser();
  const { reloadAuthSession } = useAuthSession();
  const { t } = useTranslation();
  const { color: palette } = useTheme();
  const googleNativeAuthConfig = useMemo(resolveGoogleNativeAuthConfig, []);
  const pendingAuthHandoff = peekPendingPostSignOutAuthHandoff();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(pendingAuthHandoff?.email ?? "");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoStartedMethodRef = useRef<string | null>(null);
  const pathname = "/studio/profile/add-account";

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!pendingAuthHandoff || !isAuthenticated) {
      return;
    }

    clearPendingPostSignOutAuthIntent();
    onClose();
  }, [isAuthenticated, pendingAuthHandoff, onClose]);

  const oauthRedirectTo = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        native: `queue://studio/profile/add-account`,
        scheme: "queue",
        path: "studio/profile/add-account",
      }),
    [],
  );

  const normalizedEmail = email.trim();
  const normalizedCode = code.trim();
  const isCodeReady = normalizedCode.length === OTP_LENGTH;
  const pendingAuthMethod = pendingAuthHandoff?.method ?? null;
  const restoreAccountId = pendingAuthHandoff?.restoreAccountId ?? null;

  const prepareForAccountSwitch = useCallback(
    async (method: PostSignOutAuthMethod) => {
      setPendingPostSignOutAuthHandoff({
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        intent: "sign-in",
        method,
        allowPath: pathname,
        ...(currentUser?._id ? { restoreAccountId: String(currentUser._id) } : {}),
      });

      if (!isAuthenticated) {
        return true;
      }

      await snapshotAndClearCurrentDeviceAccount(
        currentUser ? toDeviceAccountIdentity(currentUser) : null,
      );
      reloadAuthSession();
      return false;
    },
    [currentUser, isAuthenticated, normalizedEmail, reloadAuthSession],
  );

  const handleCancel = useCallback(() => {
    if (!isAuthenticated && restoreAccountId) {
      setIsSubmitting(true);
      setErrorMessage(null);
      void switchToRememberedDeviceAccount({ accountId: restoreAccountId })
        .then(() => {
          clearPendingPostSignOutAuthIntent();
          reloadAuthSession();
          onClose();
        })
        .catch((error) => {
          setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
        })
        .finally(() => {
          setIsSubmitting(false);
        });
      return;
    }

    clearPendingPostSignOutAuthIntent();
    onClose();
  }, [isAuthenticated, onClose, reloadAuthSession, restoreAccountId, t]);

  const handleBackToMethods = useCallback(() => {
    setStep("email");
    setCode("");
    setErrorMessage(null);
  }, []);

  const handleSendCode = useCallback(async () => {
    if (isSubmitting || normalizedEmail.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!(await prepareForAccountSwitch("code"))) {
        return;
      }
      await signIn("resend-otp", { email: normalizedEmail });
      setStep("code");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, normalizedEmail, prepareForAccountSwitch, signIn, t]);

  const handleVerifyCode = useCallback(async () => {
    if (isSubmitting || normalizedEmail.length === 0 || !isCodeReady) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!(await prepareForAccountSwitch("code"))) {
        return;
      }
      await signIn("resend-otp", { email: normalizedEmail, code: normalizedCode });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("auth.unexpectedError")));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isCodeReady,
    isSubmitting,
    normalizedCode,
    normalizedEmail,
    prepareForAccountSwitch,
    signIn,
    t,
  ]);

  const handleOAuth = useCallback(
    async (provider: "apple" | "google") => {
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        if (!(await prepareForAccountSwitch(provider))) {
          return;
        }

        if (provider === "google" && canUseNativeGoogleAuth(googleNativeAuthConfig)) {
          const nativeResult = await signInWithGoogleNative({
            config: googleNativeAuthConfig,
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
          ...(provider === "google" && normalizedEmail.length > 0
            ? {
                prompt: "select_account",
                login_hint: normalizedEmail,
              }
            : {}),
        });
        if (!started.redirect) {
          setErrorMessage(t("auth.oauthFailed"));
          return;
        }

        const oauthResult = await WebBrowser.openAuthSessionAsync(
          started.redirect.toString(),
          oauthRedirectTo,
        );
        if (oauthResult.type === "cancel") {
          setErrorMessage(t("auth.oauthCancelled"));
          return;
        }
        if (oauthResult.type !== "success" || !oauthResult.url) {
          setErrorMessage(t("auth.oauthFailed"));
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
      normalizedEmail,
      oauthRedirectTo,
      prepareForAccountSwitch,
      signIn,
      t,
    ],
  );

  useEffect(() => {
    if (
      pendingAuthHandoff?.email &&
      pendingAuthHandoff.email.length > 0 &&
      pendingAuthHandoff.email !== email
    ) {
      setEmail(pendingAuthHandoff.email);
    }
  }, [email, pendingAuthHandoff?.email]);

  useEffect(() => {
    const canAutoStart =
      pendingAuthMethod === "apple" ||
      pendingAuthMethod === "google" ||
      (pendingAuthMethod === "code" && normalizedEmail.length > 0);
    if (isAuthenticated || isSubmitting || !pendingAuthMethod || !canAutoStart) {
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

    void handleOAuth(pendingAuthMethod === "apple" ? "apple" : "google");
  }, [
    handleOAuth,
    handleSendCode,
    isAuthenticated,
    isSubmitting,
    normalizedEmail,
    pendingAuthMethod,
  ]);

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <ProfileSectionHeader
        label={t("profile.switcher.addAccountTitle")}
        icon="person.badge.plus"
      />

      <ProfileSectionCard>
        <View
          style={{
            gap: BrandSpacing.xs,
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.lg,
          }}
        >
          <KitTextField
            value={email}
            onChangeText={setEmail}
            editable={step === "email" && !isSubmitting}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
            placeholder={t("auth.emailPlaceholder")}
            style={{
              fontFamily: "Manrope_500Medium",
              fontSize: 16,
              fontWeight: "500",
              lineHeight: 22,
              includeFontPadding: false,
            }}
          />
          {errorMessage ? (
            <ThemedText type="caption" style={{ color: palette.danger }}>
              {errorMessage}
            </ThemedText>
          ) : null}
          <View style={{ gap: BrandSpacing.sm, paddingTop: BrandSpacing.xs }}>
            {step === "email" ? (
              <>
                <ActionButton
                  label={t("auth.sendCodeButton")}
                  onPress={() => {
                    void handleSendCode();
                  }}
                  disabled={isSubmitting || normalizedEmail.length === 0}
                  fullWidth
                  size="lg"
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BrandSpacing.sm,
                    paddingVertical: BrandSpacing.xs,
                  }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
                  <Text
                    style={{
                      fontFamily: "Manrope_400Regular",
                      fontSize: 13,
                      fontWeight: "400",
                      lineHeight: 18,
                      color: palette.textMuted,
                      letterSpacing: 0.7,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("auth.or")}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: BrandSpacing.md,
                  }}
                >
                  <IconButton
                    accessibilityLabel={t("auth.signInWithGoogle")}
                    icon={<FontAwesome5 name="google" size={24} color={palette.danger} />}
                    onPress={() => {
                      void handleOAuth("google");
                    }}
                    disabled={isSubmitting}
                    tone="secondary"
                    size={56}
                  />
                  <IconButton
                    accessibilityLabel={t("auth.signInWithApple")}
                    icon={<FontAwesome5 name="apple" size={28} color={palette.text} />}
                    onPress={() => {
                      void handleOAuth("apple");
                    }}
                    disabled={isSubmitting}
                    tone="secondary"
                    size={56}
                  />
                </View>
              </>
            ) : (
              <>
                <KitTextField
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  textContentType="oneTimeCode"
                  placeholder={t("auth.codePlaceholder")}
                  style={{
                    fontFamily: "Manrope_500Medium",
                    fontSize: 16,
                    fontWeight: "500",
                    lineHeight: 22,
                    includeFontPadding: false,
                    textAlign: "center",
                    letterSpacing: 4,
                  }}
                />
                <ActionButton
                  label={isSubmitting ? t("auth.verifyingCode") : t("auth.verifyCodeButton")}
                  onPress={() => {
                    void handleVerifyCode();
                  }}
                  disabled={isSubmitting || !isCodeReady}
                  fullWidth
                  size="lg"
                />
                <ActionButton
                  label={t("auth.backToSignInMethods")}
                  onPress={handleBackToMethods}
                  disabled={isSubmitting}
                  tone="secondary"
                  fullWidth
                  size="lg"
                />
              </>
            )}
            <ActionButton
              label={t("common.cancel")}
              onPress={handleCancel}
              disabled={isSubmitting}
              tone="secondary"
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </ProfileSectionCard>
    </BaseProfileSheet>
  );
}
