import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/hooks/use-theme";

interface DeleteAccountButtonProps {
  accountRole: "instructor" | "studio";
}

export function DeleteAccountButton({ accountRole }: DeleteAccountButtonProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const initiateDeletion = useMutation(api.deletion.mutations.initiateAccountDeletion);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInitiateDeletion = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await initiateDeletion({ role: accountRole });
      if (result.success) {
        Alert.alert(
          t("profile.deleteAccount.verificationSentTitle"),
          t("profile.deleteAccount.verificationSentMessage"),
          [{ text: t("common.ok") }],
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("common.error");
      Alert.alert(t("common.error"), message);
    } finally {
      setIsLoading(false);
      setShowConfirmation(false);
    }
  }, [accountRole, initiateDeletion, t]);

  if (showConfirmation) {
    return (
      <View style={[styles.container, { backgroundColor: color.surfaceElevated }]}>
        <Text style={[styles.warningTitle, { color: color.text }]}>
          {t("profile.deleteAccount.warningTitle")}
        </Text>
        <Text style={[styles.warningText, { color: color.textMuted }]}>
          {t("profile.deleteAccount.warningText", {
            role: accountRole === "studio" ? "studio" : "instructor",
          })}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: color.border }]}
            onPress={() => setShowConfirmation(false)}
            disabled={isLoading}
          >
            <Text style={[styles.cancelButtonText, { color: color.text }]}>
              {t("common.cancel")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: color.danger }]}
            onPress={handleInitiateDeletion}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.confirmButtonText, { color: "#FFFFFF" }]}>
                {t("profile.deleteAccount.sendCode")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.button} onPress={() => setShowConfirmation(true)}>
      <Text style={[styles.buttonText, { color: color.danger }]}>
        {t("profile.deleteAccount.button")}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: BrandSpacing.componentPadding,
    paddingHorizontal: BrandSpacing.md,
  },
  buttonText: {
    fontSize: BrandType.bodyStrong.fontSize,
    fontWeight: "500",
  },
  container: {
    padding: BrandSpacing.md,
    borderRadius: 12,
    marginHorizontal: BrandSpacing.insetSoft,
    marginVertical: BrandSpacing.sm,
  },
  warningTitle: {
    fontSize: BrandType.bodyStrong.fontSize,
    fontWeight: "600",
    marginBottom: BrandSpacing.xs,
  },
  warningText: {
    fontSize: BrandType.body.fontSize,
    lineHeight: 20,
    marginBottom: BrandSpacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: BrandSpacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: BrandSpacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: BrandType.body.fontSize,
    fontWeight: "500",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: BrandSpacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: BrandType.body.fontSize,
    fontWeight: "600",
  },
});
