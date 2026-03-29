import type { TFunction } from "i18next";
import { Alert } from "react-native";

export function openStudioComplianceGate(
  t: TFunction,
  options: {
    blockers: string;
    onOpenCompliance: () => void;
  },
) {
  Alert.alert(
    t("jobsTab.studioComplianceGate.title"),
    t("jobsTab.studioComplianceGate.body", {
      blockers: options.blockers,
    }),
    [
      {
        text: t("common.cancel"),
        style: "cancel",
      },
      {
        text: t("jobsTab.studioComplianceGate.action"),
        onPress: options.onOpenCompliance,
      },
    ],
  );
}
