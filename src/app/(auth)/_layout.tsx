import { useConvexAuth } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { useBrand } from "@/hooks/use-brand";

export default function AuthLayout() {
  const { isAuthenticated } = useConvexAuth();
  const palette = useBrand();

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: palette.text as string,
        headerTitleStyle: { color: palette.text as string },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
    </Stack>
  );
}
