import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ActionButton } from "@/components/ui/action-button";
import { BrandSpacing } from "@/constants/brand";
import { Box } from "@/primitives";

type StripeEmbeddedCheckoutDetails = {
  clientSecret: string;
  customerSessionClientSecret: string;
  amountAgorot: number;
  currency: string;
  providerCountry: string;
};

interface StripeEmbeddedCheckoutSheetProps {
  visible: boolean;
  checkout: StripeEmbeddedCheckoutDetails;
  onClose: () => void;
  onCompleted: () => void;
}

export function StripeEmbeddedCheckoutSheet({
  visible,
  checkout: _checkout,
  onClose,
  onCompleted: _onCompleted,
}: StripeEmbeddedCheckoutSheetProps) {
  const { t } = useTranslation();

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <BottomSheetScrollView contentContainerStyle={{ gap: BrandSpacing.lg }}>
        <Box style={{ padding: BrandSpacing.inset, gap: BrandSpacing.md }}>
          <NoticeBanner
            tone="success"
            message={t("jobsTab.checkout.customUi")}
            onDismiss={onClose}
          />
          <ActionButton label={t("common.close")} fullWidth onPress={onClose} />
        </Box>
      </BottomSheetScrollView>
    </BaseProfileSheet>
  );
}
