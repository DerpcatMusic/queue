import { Redirect, Slot, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { useSessionGate } from "@/modules/session/session-gate";

export default function AppGateLayout() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const gate = useSessionGate("app_layout", pathname);

  // Handle loading or undefined state
  if (!gate || gate.status === "loading") {
    return <LoadingScreen label={t("launch.loadingAccount")} />;
  }

  if (gate.status === "allow") {
    return <Slot />;
  }

  return <Redirect href={gate.href} />;
}
