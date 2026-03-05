import { Redirect, Slot, usePathname } from "expo-router";

import { LoadingScreen } from "@/components/loading-screen";
import { useSessionGate } from "@/modules/session/session-gate";

export default function AppGateLayout() {
  const pathname = usePathname();
  const gate = useSessionGate("app_layout", pathname);

  if (gate.status === "loading") {
    return <LoadingScreen label="Loading account..." />;
  }

  if (gate.status === "allow") {
    return <Slot />;
  }

  return <Redirect href={gate.href} />;
}
