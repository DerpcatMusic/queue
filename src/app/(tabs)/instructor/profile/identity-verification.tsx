import { useAction, useQuery } from "convex/react";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { NativeModules, Platform, Pressable, View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";

type DiditSdkResult = {
  type?: "completed" | "cancelled" | "failed";
  error?: { message?: string };
  session?: { status?: string };
};

type DiditSdkModule = {
  startVerification: (sessionToken: string) => Promise<DiditSdkResult>;
};

let cachedDiditSdkModule: DiditSdkModule | null | undefined;

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  declined: "Declined",
  in_review: "In review",
  pending: "Pending",
  in_progress: "In progress",
  abandoned: "Abandoned",
  expired: "Expired",
  not_started: "Not started",
};

const resolveDiditSdkModule = async (): Promise<DiditSdkModule | null> => {
  if (cachedDiditSdkModule !== undefined) {
    return cachedDiditSdkModule;
  }

  if (Platform.OS === "web" || Constants.appOwnership === "expo") {
    cachedDiditSdkModule = null;
    return cachedDiditSdkModule;
  }

  const nativeDiditModule =
    typeof NativeModules === "object" && NativeModules !== null
      ? (NativeModules as Record<string, unknown>).SdkReactNative
      : undefined;
  const turboModuleProxy = (
    global as typeof global & { __turboModuleProxy?: (name: string) => unknown }
  ).__turboModuleProxy;
  const turboDiditModule =
    typeof turboModuleProxy === "function" ? turboModuleProxy("SdkReactNative") : undefined;
  if (!nativeDiditModule && !turboDiditModule) {
    cachedDiditSdkModule = null;
    return cachedDiditSdkModule;
  }

  try {
    cachedDiditSdkModule = (await import("@didit-protocol/sdk-react-native")) as DiditSdkModule;
    return cachedDiditSdkModule;
  } catch {
    cachedDiditSdkModule = null;
    return cachedDiditSdkModule;
  }
};

const toNormalizedStatus = (raw: string | undefined): string => {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("approve")) return "approved";
  if (value.includes("declin")) return "declined";
  if (value.includes("review")) return "in_review";
  if (value.includes("pending")) return "pending";
  if (value.includes("progress")) return "in_progress";
  if (value.includes("abandon")) return "abandoned";
  if (value.includes("expir")) return "expired";
  return "not_started";
};

export default function IdentityVerificationScreen() {
  const palette = useBrand();
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const diditVerification = useQuery(
    api.didit.getMyDiditVerification,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const createSessionForCurrentInstructor = useAction(api.didit.createSessionForCurrentInstructor);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  if (
    currentUser === undefined ||
    (currentUser?.role === "instructor" && diditVerification === undefined)
  ) {
    return <LoadingScreen label="Loading verification status..." />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (currentUser.role !== "instructor") {
    return <Redirect href="/(tabs)/studio/profile" />;
  }

  const status = localStatus ?? diditVerification?.status ?? "not_started";
  const isVerified = diditVerification?.isVerified ?? false;
  const statusLabel = STATUS_LABELS[status] ?? "Not started";
  const verifiedAtLabel = diditVerification?.verifiedAt
    ? new Date(diditVerification.verifiedAt).toLocaleString()
    : null;

  const startVerification = async () => {
    setBusy(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const session = await createSessionForCurrentInstructor({});
      const sdk = await resolveDiditSdkModule();

      if (!sdk) {
        await WebBrowser.openBrowserAsync(session.verificationUrl);
        setInfoMessage(
          "Native SDK is unavailable in this app build. Opened hosted verification instead. Rebuild dev client after installing Didit plugin.",
        );
        return;
      }

      const result = await sdk.startVerification(session.sessionToken);
      if (result.type === "completed") {
        const nextStatus = toNormalizedStatus(result.session?.status);
        setLocalStatus(nextStatus);
        setInfoMessage("Verification flow completed. Final decision will sync from webhook.");
      } else if (result.type === "cancelled") {
        setInfoMessage("Verification flow was cancelled.");
      } else {
        setErrorMessage(result.error?.message ?? "Didit SDK failed to complete verification.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create Didit session. Check backend env vars and workflow setup.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <TabScreenScrollView
      routeKey="instructor/profile"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 20 }}
    >
      <View
        style={{ paddingHorizontal: BrandSpacing.lg, flexDirection: "row", alignItems: "center" }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, marginLeft: -8, marginRight: 8 }}
        >
          <IconSymbol name="chevron.left" size={24} color={palette.text} />
        </Pressable>
        <ThemedText type="heading" style={{ flex: 1, fontSize: 24 }}>
          Identity Verification
        </ThemedText>
      </View>

      <View style={{ paddingHorizontal: BrandSpacing.md }}>
        <View
          style={{
            backgroundColor: palette.surfaceAlt,
            borderRadius: 24,
            padding: 18,
            gap: 8,
          }}
        >
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            Current status
          </ThemedText>
          <ThemedText type="title">{statusLabel}</ThemedText>
          {isVerified ? (
            <ThemedText type="caption" style={{ color: palette.success }}>
              Verified badge active
            </ThemedText>
          ) : null}
          {diditVerification?.legalName ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              Legal name: {diditVerification.legalName}
            </ThemedText>
          ) : null}
          {verifiedAtLabel ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              Verified at {verifiedAtLabel}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: BrandSpacing.md }}>
        <Pressable
          onPress={startVerification}
          disabled={busy}
          style={{
            backgroundColor: busy ? palette.borderStrong : palette.primary,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: "center",
          }}
        >
          <ThemedText type="bodyStrong" style={{ color: "#fff" }}>
            {busy ? "Starting verification..." : "Start Didit Verification"}
          </ThemedText>
        </Pressable>
      </View>

      {errorMessage ? (
        <View style={{ paddingHorizontal: BrandSpacing.md }}>
          <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
        </View>
      ) : null}
      {infoMessage ? (
        <View style={{ paddingHorizontal: BrandSpacing.md }}>
          <ThemedText style={{ color: palette.textMuted }}>{infoMessage}</ThemedText>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: BrandSpacing.md }}>
        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          Requires a development build. Expo Go will use hosted verification as a fallback.
        </ThemedText>
      </View>
    </TabScreenScrollView>
  );
}
