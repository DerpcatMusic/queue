import { Redirect } from "expo-router";

export default function StudioComplianceScreen() {
  return <Redirect href="/onboarding/verification?role=studio" />;
}
