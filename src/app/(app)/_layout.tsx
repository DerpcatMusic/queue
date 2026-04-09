import { Redirect, Slot, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { useSessionGate } from "@/modules/session/session-gate";

// Public profile routes bypass the auth gate entirely.
// These routes are accessible without authentication.
const PUBLIC_PROFILE_PATH_PREFIXES = ["/instructor/", "/studio/"] as const;

export default function AppGateLayout() {
  const { t } = useTranslation();
  const pathname = usePathname();

  // Always call the session gate hook to maintain consistent hook order
  const gate = useSessionGate("app_layout", pathname);

  // Allow public profile routes without authentication
  const isPublic = PUBLIC_PROFILE_PATH_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length,
  );

  if (isPublic) {
    return <Slot />;
  }

  // Handle loading or undefined state
  if (!gate || gate.status === "loading") {
    return (
      <LoadingScreen
        variant="launch"
        title={t("launch.title")}
        label={t("launch.loadingAccount")}
      />
    );
  }

  if (gate.status === "allow") {
    return <Slot />;
  }

  return <Redirect href={gate.href} />;
}
