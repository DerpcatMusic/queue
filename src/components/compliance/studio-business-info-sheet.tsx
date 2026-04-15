import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { StudioBusinessInfoForm } from "@/components/compliance/studio-business-info-form";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { BrandSpacing } from "@/constants/brand";
import type { BillingProfileSnapshot } from "@/features/compliance/use-studio-billing-form";
import { useTheme } from "@/hooks/use-theme";

interface StudioBusinessInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  billingProfile: BillingProfileSnapshot | null | undefined;
  currentUserEmail?: string;
  currentUserPhone?: string;
  defaultBusinessName?: string;
}

export function StudioBusinessInfoSheet({
  visible,
  onClose,
  billingProfile,
  currentUserEmail,
  currentUserPhone,
  defaultBusinessName,
}: StudioBusinessInfoSheetProps) {
  const theme = useTheme();

  return (
    <BaseProfileSheet visible={visible} onClose={onClose} scrollable>
      <BottomSheetScrollView
        contentContainerStyle={{
          gap: BrandSpacing.md,
          backgroundColor: theme.color.appBg,
        }}
      >
        <StudioBusinessInfoForm
          billingProfile={billingProfile}
          {...(currentUserEmail ? { currentUserEmail } : {})}
          {...(currentUserPhone ? { currentUserPhone } : {})}
          {...(defaultBusinessName ? { defaultBusinessName } : {})}
        />
      </BottomSheetScrollView>
    </BaseProfileSheet>
  );
}
