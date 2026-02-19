import { Platform } from "react-native";

import { AndroidJobsScreen } from "./jobs-screen.android";
import { IosJobsScreen } from "./jobs-screen.ios";
import type { JobsScreenProps } from "./jobs-screen.types";

export function JobsScreen(props: JobsScreenProps) {
  if (Platform.OS === "ios") {
    return <IosJobsScreen {...props} />;
  }

  return <AndroidJobsScreen {...props} />;
}
