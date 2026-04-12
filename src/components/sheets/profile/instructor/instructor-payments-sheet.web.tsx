/**
 * Web stub for InstructorPaymentsSheet.
 *
 * Stripe embedded components are native-only. On web, we render a simple
 * status view inside the bottom sheet.
 */

import { useTranslation } from "react-i18next";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ThemedText } from "@/components/themed-text";
import { KitStatusBadge } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

interface InstructorPaymentsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorPaymentsSheet({ visible, onClose }: InstructorPaymentsSheetProps) {
  const { t } = useTranslation();
  const { color } = useTheme();

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Box style={{ padding: BrandSpacing.lg, gap: BrandSpacing.lg }}>
        <KitStatusBadge
          label={t("profile.payments.statusAllSet")}
          tone="success"
          showDot
        />
        <ThemedText type="body" style={{ color: color.textMuted }}>
          {t("profile.payments.summarySubtitle")}
        </ThemedText>
      </Box>
    </BaseProfileSheet>
  );
}
