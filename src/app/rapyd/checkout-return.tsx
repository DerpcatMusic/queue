import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";

export default function RapydCheckoutReturnScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    router.replace("/studio/jobs");
  }, [router]);

  return <LoadingScreen label={t("common.returningToCheckoutStatus")} />;
}
