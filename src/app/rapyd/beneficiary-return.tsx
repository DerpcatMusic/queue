import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";

export default function RapydBeneficiaryReturnScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    router.replace("/instructor/profile/payments");
  }, [router]);

  return <LoadingScreen label={t("common.returningToPayoutSetup")} />;
}
