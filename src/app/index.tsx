import { Redirect } from "expo-router";

import { LoadingScreen } from "@/components/loading-screen";
import { useSessionGate } from "@/modules/session/session-gate";

export default function RootIndexRoute() {
  const gate = useSessionGate("index");

  if (gate.status === "loading") {
    return <LoadingScreen label="Loading account..." />;
  }

  return <Redirect href={gate.href} />;
}
