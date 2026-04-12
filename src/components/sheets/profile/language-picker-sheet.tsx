/**
 * Language Picker Sheet — modal bottom sheet for choosing app language.
 */

import type { BottomSheetModal as BottomSheetModalRef } from "@gorhom/bottom-sheet";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n";
import { useAppLanguage } from "@/hooks/use-app-language";
import { Box, Text } from "@/primitives";

interface LanguagePickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePickerSheet({ visible, onClose }: LanguagePickerSheetProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { language, setLanguage } = useAppLanguage();
  const ref = useRef<BottomSheetModalRef>(null);

  const presentedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      presentedRef.current = true;
      ref.current?.present();
    } else if (presentedRef.current) {
      ref.current?.dismiss();
    }
  }, [visible]);

  const handleCloseRequest = useCallback(() => {
    ref.current?.dismiss();
  }, []);

  const handleDismiss = useCallback(() => {
    presentedRef.current = false;
    onClose();
  }, [onClose]);

  const handleSelect = useCallback(
    async (lang: AppLanguage) => {
      await setLanguage(lang);
      ref.current?.dismiss();
    },
    [setLanguage],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={[props.style, styles.backdrop]}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  const languageOptions: { code: AppLanguage; nativeName: string }[] = [
    { code: "en", nativeName: "English" },
    { code: "he", nativeName: "עברית" },
    { code: "fr", nativeName: "Français" },
    { code: "de", nativeName: "Deutsch" },
    { code: "es", nativeName: "Español" },
    { code: "da", nativeName: "Dansk" },
  ];

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={["70%"]}
      enablePanDownToClose={true}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        borderTopLeftRadius: BrandRadius.soft,
        borderTopRightRadius: BrandRadius.soft,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
      }}
      handleIndicatorStyle={{
        width: 36,
        height: 5,
        borderRadius: 3,
        backgroundColor: theme.color.borderStrong,
      }}
      style={styles.sheet}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: BrandSpacing.inset,
          paddingVertical: BrandSpacing.md,
          minHeight: 52,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.color.divider,
        }}
      >
        <IconButton
          accessibilityLabel={t("common.close")}
          onPress={handleCloseRequest}
          tone="secondary"
          size={36}
          icon={<IconSymbol name="xmark" size={18} color={theme.color.textMuted} />}
        />
        <View style={styles.titleSpacer} />
      </View>

      <BottomSheetScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.xxl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="title" style={{ marginBottom: BrandSpacing.lg }}>
          {t("profile.language.title")}
        </Text>

        <Box gap="sm">
          {languageOptions.map(({ code, nativeName }) => {
            const isSelected = language === code;
            const displayName = t(`language.${code}`, nativeName);

            return (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityLabel={`${displayName} — ${nativeName}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleSelect(code)}
                style={(state) => [
                  styles.languageRow,
                  {
                    backgroundColor: isSelected
                      ? theme.color.primarySubtle
                      : state.pressed
                        ? theme.color.surfaceElevated
                        : theme.color.surfaceElevated,
                  },
                ]}
              >
                <View style={styles.languageTextContainer}>
                  <Text variant="bodyMedium" style={{ color: theme.color.text }}>
                    {displayName}
                  </Text>
                  <Text variant="caption" style={{ color: theme.color.textMuted }}>
                    {nativeName}
                  </Text>
                </View>
                {isSelected ? (
                  <IconSymbol name="checkmark" size={20} color={theme.color.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </Box>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 0,
  },
  backdrop: {
    backgroundColor: "#000000",
  },
  titleSpacer: {
    flex: 1,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    minHeight: 56,
  },
  languageTextContainer: {
    flex: 1,
    gap: 2,
  },
});
