import { Alert, Linking } from "react-native";

type OpenSettingsAlertOptions = {
  body: string;
  cancelLabel: string;
  settingsLabel: string;
  title: string;
};

export function showOpenSettingsAlert(options: OpenSettingsAlertOptions) {
  Alert.alert(options.title, options.body, [
    {
      text: options.cancelLabel,
      style: "cancel",
    },
    {
      text: options.settingsLabel,
      onPress: () => {
        void Linking.openSettings().catch(() => undefined);
      },
    },
  ]);
}
