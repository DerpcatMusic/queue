import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { useSessionGate } from "@/modules/session/session-gate";

export default function RootIndexRoute() {
  const { t } = useTranslation();
  const gate = useSessionGate("index");

  if (gate.status === "loading") {
    return (
      <LoadingScreen
        variant="launch"
        title={t("launch.title")}
        label={t("launch.loadingAccount")}
      />
    );
  }

  return <Redirect href={gate.href} />;
}
