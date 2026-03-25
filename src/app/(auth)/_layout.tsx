import { useConvexAuth } from "convex/react";
import { Redirect, Stack, useGlobalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { useBrand } from "@/hooks/use-brand";
import { useSessionGate } from "@/modules/session/session-gate";

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function AuthLayout() {
  const { isAuthenticated } = useConvexAuth();
  const { t } = useTranslation();
  const palette = useBrand();
  const gate = useSessionGate("index");
  const searchParams = useGlobalSearchParams<{ switchAccount?: string | string[] }>();
  const isSwitchAccountFlow = readParam(searchParams.switchAccount) === "1";

  if (
    isAuthenticated &&
    !isSwitchAccountFlow &&
    gate.status === "redirect" &&
    gate.href !== "/sign-in"
  ) {
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
