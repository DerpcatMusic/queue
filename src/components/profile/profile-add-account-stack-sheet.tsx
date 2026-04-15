import { useAuthActions } from "@convex-dev/auth/react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useConvexAuth } from "convex/react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ProfileSectionCard, ProfileSectionHeader } from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import { BrandSpacing } from "@/constants/brand";
import { useAuthSession } from "@/contexts/auth-session-context";
import { useUser } from "@/contexts/user-context";
import { useTheme } from "@/hooks/use-theme";
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
  clearPendingPostSignOutAuthIntent,
  type PostSignOutAuthMethod,
  peekPendingPostSignOutAuthHandoff,
  setPendingPostSignOutAuthHandoff,
} from "@/modules/session/post-signout-auth-intent";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { useBottomSheetStack } from "@/components";

type Step = "root" | "email" | "code" | "google" | "apple";

const OTP_LENGTH = 6;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type AddAccountFlowSheetProps = {
  onClose: () => void;
  pathname: string;
  visible: boolean;
  initialMethod?: "email" | "google" | "apple";
};

function AddAccountFlowSheet({
  onClose,
  pathname,
  visible,
  initialMethod,
}: AddAccountFlowSheetProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const { currentUser } = useUser();
  const { restartAppSession } = useAuthSession();
  const { t } = useTranslation();
  const { color: palette } = useTheme();
  const googleNativeAuthConfig = useMemo(resolveGoogleNativeAuthConfig, []);
  const pendingAuthHandoff = peekPendingPostSignOutAuthHandoff();
  const [step, setStep] = useState<Step>("root");
  const [email, setEmail] = useState(pendingAuthHandoff?.email ?? "");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoStartedMethodRef = useRef<string | null>(null);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!visible) {
      setStep("root");
      setCode("");
      setErrorMessage(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!pendingAuthHandoff || !isAuthenticated) {
      return;
    }

    clearPendingPostSignOutAuthIntent();
    onClose();
  }, [isAuthenticated, onClose, pendingAuthHandoff]);

  const pathWithoutLeadingSlash = pathname.replace(/^\/+/, "");
  const oauthRedirectTo = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        native: `queue://${pathWithoutLeadingSlash}`,
        scheme: "queue",
        path: pathWithoutLeadingSlash,
      }),
    [pathWithoutLeadingSlash],
  );

  const normalizedEmail = email.trim();
  const normalizedCode = code.trim();
  const isCodeReady = normalizedCode.length === OTP_LENGTH;
  const pendingAuthMethod = pendingAuthHandoff?.method ?? initialMethod ?? null;
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
      restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
      return false;
    },
    [currentUser, isAuthenticated, normalizedEmail, pathname, restartAppSession],
  );

  const handleCancel = useCallback(() => {
    if (!isAuthenticated && restoreAccountId) {
      setIsSubmitting(true);
      setErrorMessage(null);
      void switchToRememberedDeviceAccount({ accountId: restoreAccountId })
        .then(() => {
          clearPendingPostSignOutAuthIntent();
          restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
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
  }, [isAuthenticated, onClose, restartAppSession, restoreAccountId, t]);

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
      restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
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
    restartAppSession,
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
          restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
          onClose();
          return;
        }

        if (provider === "apple") {
          const nativeResult = await signInWithAppleNative();

          if (nativeResult.type === "success") {
            await signIn("apple-native", { idToken: nativeResult.identityToken });
            restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
            onClose();
            return;
          }

          if (nativeResult.type === "cancelled") {
            setErrorMessage(t("auth.oauthCancelled"));
            return;
          }
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
        restartAppSession({ immediate: true, reloadAuth: true, transitionMs: 7000 });
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
      onClose,
      prepareForAccountSwitch,
      restartAppSession,
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
    if (!pendingAuthMethod || isAuthenticated || isSubmitting) {
      return;
    }

    const nextStep =
      pendingAuthMethod === "code"
        ? "email"
        : pendingAuthMethod === "google"
          ? "google"
          : pendingAuthMethod === "apple"
            ? "apple"
            : "root";
    if (nextStep !== "root" && step !== nextStep) {
      setStep(nextStep);
    }

    const autoStartKey = `${pendingAuthMethod}:${normalizedEmail.toLowerCase()}`;
    if (autoStartedMethodRef.current === autoStartKey) {
      return;
    }

    const canAutoStart =
      pendingAuthMethod === "google" ||
      pendingAuthMethod === "apple" ||
      (pendingAuthMethod === "code" && normalizedEmail.length > 0);
    if (!canAutoStart) {
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
    step,
  ]);

  const closeChildSheet = useCallback(() => {
    if (step === "code") {
      setStep("email");
      return;
    }
    setStep("root");
  }, [step]);

  const providerLabel =
    step === "google"
      ? t("auth.signInWithGoogle")
      : step === "apple"
        ? t("auth.signInWithApple")
        : null;

  return (
    <>
      <BaseProfileSheet visible={visible} onClose={handleCancel} snapPoints={["46%"]}>
        <ProfileSectionHeader
          label={t("profile.switcher.addAccountTitle")}
          description={t("profile.switcher.addAccountBody")}
          icon="person.badge.plus"
        />

        <ProfileSectionCard>
          <View
            style={{
              gap: BrandSpacing.sm,
              opacity: step === "root" ? 1 : 0.35,
            }}
            pointerEvents={step === "root" ? "auto" : "none"}
          >
            <ActionButton
              label={t("auth.emailLabel")}
              onPress={() => {
                setErrorMessage(null);
                setStep("email");
              }}
              tone="secondary"
              fullWidth
              size="lg"
            />
            <ActionButton
              label={t("auth.signInWithGoogle")}
              onPress={() => {
                setErrorMessage(null);
                setStep("google");
              }}
              tone="secondary"
              fullWidth
              size="lg"
            />
            <ActionButton
              label={t("auth.signInWithApple")}
              onPress={() => {
                setErrorMessage(null);
                setStep("apple");
              }}
              tone="secondary"
              fullWidth
              size="lg"
            />
            <ActionButton
              label={t("common.cancel")}
              onPress={handleCancel}
              disabled={isSubmitting}
              tone="secondary"
              fullWidth
              size="lg"
            />
          </View>
        </ProfileSectionCard>
      </BaseProfileSheet>

      <BaseProfileSheet
        visible={visible && (step === "email" || step === "code")}
        onClose={closeChildSheet}
        snapPoints={["72%"]}
        stackBehavior="push"
      >
        <ProfileSectionHeader
          label={t("auth.emailLabel")}
          description={
            step === "code" ? t("auth.codeSheetSubtitle") : t("profile.switcher.addAccountFieldHint")
          }
          icon="envelope.fill"
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
            {step === "code" ? (
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {normalizedEmail}
              </ThemedText>
            ) : null}
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
                  <ActionButton
                    label={t("common.cancel")}
                    onPress={closeChildSheet}
                    disabled={isSubmitting}
                    tone="secondary"
                    fullWidth
                    size="lg"
                  />
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
                    onPress={() => {
                      setCode("");
                      setErrorMessage(null);
                      setStep("email");
                    }}
                    disabled={isSubmitting}
                    tone="secondary"
                    fullWidth
                    size="lg"
                  />
                </>
              )}
            </View>
          </View>
        </ProfileSectionCard>
      </BaseProfileSheet>

      <BaseProfileSheet
        visible={visible && (step === "google" || step === "apple")}
        onClose={closeChildSheet}
        snapPoints={["54%"]}
        stackBehavior="push"
      >
        <ProfileSectionHeader
          label={providerLabel ?? t("profile.switcher.addAccountTitle")}
          description={
            step === "google"
              ? "Choose a Google account saved on this device, or add another one in the system picker."
              : "Continue with Apple to use the Apple ID available on this device."
          }
          icon={step === "google" ? "globe" : "apple.logo"}
        />

        <ProfileSectionCard>
          <View
            style={{
              gap: BrandSpacing.sm,
              paddingHorizontal: BrandSpacing.lg,
              paddingVertical: BrandSpacing.lg,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: BrandSpacing.md,
              }}
            >
              <IconButton
                accessibilityLabel={providerLabel ?? t("profile.switcher.addAccountTitle")}
                icon={
                  <FontAwesome5
                    name={step === "google" ? "google" : "apple"}
                    size={step === "google" ? 24 : 28}
                    color={step === "google" ? palette.danger : palette.text}
                  />
                }
                onPress={() => {
                  if (step === "google" || step === "apple") {
                    void handleOAuth(step);
                  }
                }}
                disabled={isSubmitting}
                tone="secondary"
                size={56}
              />
            </View>

            {errorMessage ? (
              <ThemedText type="caption" style={{ color: palette.danger }}>
                {errorMessage}
              </ThemedText>
            ) : null}

            <ActionButton
              label={step === "google" ? "Choose Google account" : "Continue with Apple"}
              onPress={() => {
                if (step === "google" || step === "apple") {
                  void handleOAuth(step);
                }
              }}
              disabled={isSubmitting}
              fullWidth
              size="lg"
            />
            <ActionButton
              label={t("auth.emailLabel")}
              onPress={() => {
                setErrorMessage(null);
                setStep("email");
              }}
              disabled={isSubmitting}
              tone="secondary"
              fullWidth
              size="lg"
            />
            <ActionButton
              label={t("common.cancel")}
              onPress={closeChildSheet}
              disabled={isSubmitting}
              tone="secondary"
              fullWidth
              size="lg"
            />
          </View>
        </ProfileSectionCard>
      </BaseProfileSheet>
    </>
  );
}

type ProfileAddAccountStackSheetProps = {
  onClose: () => void;
  pathname: string;
  visible: boolean;
};

export function ProfileAddAccountStackSheet({
  onClose,
  pathname,
  visible,
}: ProfileAddAccountStackSheetProps) {
  const { t } = useTranslation();
  const { popToRoot, pushSheet } = useBottomSheetStack();

  const openFlowSheet = useCallback(
    (initialMethod: "email" | "google" | "apple") => {
      pushSheet({
        component: (
          <AddAccountFlowSheet
            visible
            onClose={() => {
              popToRoot();
            }}
            pathname={pathname}
            initialMethod={initialMethod}
          />
        ),
      });
    },
    [pathname, popToRoot, pushSheet],
  );

  const handleClose = useCallback(() => {
    popToRoot();
    onClose();
  }, [onClose, popToRoot]);

  return (
    <BaseProfileSheet visible={visible} onClose={handleClose} snapPoints={["46%"]}>
      <ProfileSectionHeader
        label={t("profile.switcher.addAccountTitle")}
        description={t("profile.switcher.addAccountBody")}
        icon="person.badge.plus"
      />

      <ProfileSectionCard>
        <ActionButton
          label={t("auth.emailLabel")}
          onPress={() => {
            openFlowSheet("email");
          }}
          tone="secondary"
          fullWidth
          size="lg"
        />
        <View style={{ height: BrandSpacing.sm }} />
        <ActionButton
          label={t("auth.signInWithGoogle")}
          onPress={() => {
            openFlowSheet("google");
          }}
          tone="secondary"
          fullWidth
          size="lg"
        />
        <View style={{ height: BrandSpacing.sm }} />
        <ActionButton
          label={t("auth.signInWithApple")}
          onPress={() => {
            openFlowSheet("apple");
          }}
          tone="secondary"
          fullWidth
          size="lg"
        />
        <View style={{ height: BrandSpacing.sm }} />
        <ActionButton
          label={t("common.cancel")}
          onPress={handleClose}
          tone="secondary"
          fullWidth
          size="lg"
        />
      </ProfileSectionCard>
    </BaseProfileSheet>
  );
}
