import { useAction, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { Box } from "@/primitives";

const AIRWALLEX_COMPONENTS_CDN =
  "https://cdn.jsdelivr.net/npm/@airwallex/components-sdk@1.28.3/+esm";

type EmbeddedSession = {
  provider: "airwallex";
  providerAccountId: string;
  authCode: string;
  clientId: string;
  codeVerifier: string;
  sdkEnvironment: "demo" | "prod";
  locale: "en" | "fr" | "zh";
};

function buildEmbeddedKycHtml(session: EmbeddedSession) {
  const sessionJson = JSON.stringify(session);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body, #app { margin: 0; padding: 0; height: 100%; background: #f6f4fb; }
      #container { height: 100%; width: 100%; }
      .loading {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5b5568;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 15px;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div id="loading" class="loading">Loading secure Airwallex onboarding…</div>
      <div id="container"></div>
    </div>
    <script type="module">
      const session = ${sessionJson};
      const postMessage = (payload) => {
        window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
      };

      try {
        const sdk = await import("${AIRWALLEX_COMPONENTS_CDN}");
        await sdk.init({
          env: session.sdkEnvironment,
          locale: session.locale,
          enabledElements: ["onboarding"],
          authCode: session.authCode,
          clientId: session.clientId,
          codeVerifier: session.codeVerifier,
        });
        const element = await sdk.createElement("kyc", {
          hideHeader: true,
          hideNav: true,
        });
        element.on("ready", (event) => {
          const loading = document.getElementById("loading");
          if (loading) loading.remove();
          postMessage({ type: "ready", event });
        });
        element.on("success", () => postMessage({ type: "success" }));
        element.on("cancel", () => postMessage({ type: "cancel" }));
        element.on("error", (error) => postMessage({ type: "error", error }));
        element.mount("container");
      } catch (error) {
        postMessage({
          type: "fatal",
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    </script>
  </body>
</html>`;
}

export default function AirwallexOnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();

  useProfileSubpageSheet({
    title: t("profile.payments.airwallexOnboardingTitle"),
    routeMatchPath: "/profile/airwallex-onboarding",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const createSession = useAction(api.paymentsV2Actions.createMyInstructorEmbeddedOnboardingSessionV2);
  const [session, setSession] = useState<EmbeddedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (currentUser === undefined) {
      return;
    }
    if (!currentUser || currentUser.role !== "instructor") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void createSession({ locale: i18n.resolvedLanguage ?? "en" })
      .then((result) => {
        if (!cancelled) {
          setSession(result);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : t("profile.payments.airwallexOnboardingLoadFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [createSession, currentUser, i18n.resolvedLanguage, reloadNonce, t]);

  const html = useMemo(() => (session ? buildEmbeddedKycHtml(session) : null), [session]);

  if (currentUser === undefined || loading) {
    return <LoadingScreen label={t("profile.payments.airwallexOnboardingLoading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (currentUser.role !== "instructor") {
    return <Redirect href="/" />;
  }

  if (error || !html) {
    return (
      <ProfileSubpageScrollView
        routeKey="instructor/profile/airwallex-onboarding"
        style={{ flex: 1, backgroundColor: color.appBg }}
        contentContainerStyle={{ gap: BrandSpacing.lg }}
        topSpacing={BrandSpacing.md}
        bottomSpacing={BrandSpacing.xxl}
      >
        <Box style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.md }}>
          <Box
            style={{
              backgroundColor: color.dangerSubtle,
              borderRadius: BrandRadius.lg,
              paddingHorizontal: BrandSpacing.component,
              paddingVertical: BrandSpacing.component,
              borderWidth: BorderWidth.thin,
              borderColor: color.danger,
            }}
          >
            <ThemedText type="bodyStrong">{t("profile.payments.airwallexOnboardingLoadFailed")}</ThemedText>
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              {error ?? t("profile.payments.airwallexOnboardingRetryHint")}
            </ThemedText>
          </Box>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.retry")}
            onPress={() => {
              setSession(null);
              setError(null);
              setLoading(true);
              setReloadNonce((value) => value + 1);
            }}
            style={({ pressed }) => ({
              minHeight: BrandSpacing.buttonMinHeightXl,
              borderRadius: BrandRadius.medium,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "#D9FF4D" : "#CCFF00",
            })}
          >
            <ThemedText type="labelStrong" style={{ color: "#161E00" }}>
              {t("common.retry")}
            </ThemedText>
          </Pressable>
        </Box>
      </ProfileSubpageScrollView>
    );
  }

  return (
    <Box style={{ flex: 1, backgroundColor: color.appBg }}>
      <Box style={{ paddingHorizontal: BrandSpacing.lg, paddingVertical: BrandSpacing.md }}>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.airwallexOnboardingHint")}
        </ThemedText>
      </Box>
      {error ? (
        <Box style={{ paddingHorizontal: BrandSpacing.lg, paddingBottom: BrandSpacing.sm }}>
          <Box
            style={{
              backgroundColor: color.dangerSubtle,
              borderRadius: BrandRadius.lg,
              paddingHorizontal: BrandSpacing.component,
              paddingVertical: BrandSpacing.stackDense,
              borderWidth: BorderWidth.thin,
              borderColor: color.danger,
            }}
          >
            <ThemedText type="caption" style={{ color: color.danger }}>
              {error}
            </ThemedText>
          </Box>
        </Box>
      ) : null}
      <WebView
        source={{ html, baseUrl: "https://www.airwallex.com" }}
        originWhitelist={["*"]}
        javaScriptEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              error?: { message?: string };
            };
            if (payload.type === "success" || payload.type === "cancel") {
              router.back();
              return;
            }
            if (payload.type === "error" || payload.type === "fatal") {
              setError(payload.error?.message ?? t("profile.payments.airwallexOnboardingLoadFailed"));
            }
          } catch {
            setError(t("profile.payments.airwallexOnboardingLoadFailed"));
          }
        }}
      />
    </Box>
  );
}
