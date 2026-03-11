import { useConvexAuth } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBrand } from "@/hooks/use-brand";
import { useSessionGate } from "@/modules/session/session-gate";

export default function AuthLayout() {
  const { isAuthenticated } = useConvexAuth();
  const { t } = useTranslation();
  const palette = useBrand();
  const gate = useSessionGate("index");

  if (isAuthenticated && gate.status === "redirect" && gate.href !== "/sign-in") {
    return <Redirect href={gate.href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: palette.text as string,
        headerTitleStyle: { color: palette.text as string },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: t("auth.navigation.signIn") }} />
    </Stack>
  );
}
