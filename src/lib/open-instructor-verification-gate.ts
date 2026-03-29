import type { TFunction } from "i18next";
import { Alert } from "react-native";

export function openInstructorVerificationGate(
  t: TFunction,
  options: {
    onVerifyNow: () => void;
  },
) {
  Alert.alert(
    t("jobsTab.verificationGate.title"),
    t("jobsTab.verificationGate.body"),
    [
      {
        text: t("common.cancel"),
        style: "cancel",
      },
      {
        text: t("jobsTab.verificationGate.action"),
        onPress: options.onVerifyNow,
      },
    ],
  );
}
