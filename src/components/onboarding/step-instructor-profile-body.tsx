// Step 1 - Instructor profile details body
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { ThemedText } from "@/components/themed-text";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OnboardingStyles = Record<string, any>;

interface StepInstructorProfileBodyProps {
  detailsReady: boolean;
  isDesktop: boolean;
  showLocationSection: boolean;
  isSubmitting: boolean;
  instructorForm: React.ReactNode;
  mapPane: React.ReactNode;
  onBack: () => void;
  onRevealLocation: () => void;
  onSubmit: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: OnboardingStyles;
}

export function StepInstructorProfileBody({
  detailsReady,
  isDesktop,
  showLocationSection,
  isSubmitting,
  instructorForm,
  mapPane,
  onBack,
  onRevealLocation,
  onSubmit,
  styles,
}: StepInstructorProfileBodyProps) {
  const { t } = useTranslation();
  const color = { primary: "#8B5CF6", textMuted: "#6B7280" };

  if (!detailsReady) {
    return (
      <View style={styles.detailsLoadingStage}>
        <View style={styles.detailsLoadingHeader}>
          <ThemedText type="title">{t("onboarding.loading")}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {t("onboarding.sheetInstructorSubtitle")}
          </ThemedText>
        </View>
        <View style={styles.detailsLoadingRow}>
          <ActivityIndicator color={color.primary} />
          <ThemedText style={{ color: color.textMuted }}>
            {t("onboarding.loading")}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}>
      {instructorForm}
      {mapPane}
      <View style={styles.navBar}>
        <View style={styles.navRowSplit}>
          <View style={styles.navAction}>
            <ActionButton label={t("onboarding.back")} tone="secondary" fullWidth onPress={onBack} />
          </View>
          <View style={styles.navAction}>
            <ActionButton
              label={showLocationSection ? t("onboarding.save") : t("onboarding.continue")}
              disabled={isSubmitting}
              fullWidth
              onPress={() => {
                if (!showLocationSection) {
                  onRevealLocation();
                  return;
                }
                void onSubmit();
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
