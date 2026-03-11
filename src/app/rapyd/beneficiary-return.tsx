import { useRouter } from "expo-router";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/loading-screen";

export default function RapydBeneficiaryReturnScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/instructor/profile/payments");
  }, [router]);

  return <LoadingScreen label="Returning to payout setup..." />;
}
