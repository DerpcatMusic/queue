import { useRouter } from "expo-router";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/loading-screen";

export default function RapydCheckoutReturnScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/studio/jobs");
  }, [router]);

  return <LoadingScreen label="Returning to checkout status..." />;
}
