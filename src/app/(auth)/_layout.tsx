import { useConvexAuth } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
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
    <ScrollSheetProvider>
      <GlobalTopSheetProvider>
        <View className="flex-1 bg-app-bg">
          <GlobalTopSheet />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: palette.appBg,
              },
            }}
          >
            <Stack.Screen name="sign-in" options={{ title: t("auth.navigation.signIn") }} />
          </Stack>
        </View>
      </GlobalTopSheetProvider>
    </ScrollSheetProvider>
  );
}
