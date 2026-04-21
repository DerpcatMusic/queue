import { useRouter } from "expo-router";
import { View, Text, Pressable, Platform, UIManager } from "react-native";
import { useTranslation } from "react-i18next";
import { useRef, useMemo, useCallback } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet } from "react-native-unistyles";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const EUROPEAN_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "sv", label: "Svenska" },
  { code: "el", label: "Ελληνικά" },
  { code: "he", label: "עברית" },
];

function SignInStyleButton({
  title,
  icon,
  onPress,
  delay,
}: {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  delay: number;
}) {
  const { color } = useTheme();
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: isPressed.value === 1 ? 0.82 : 1,
    };
  });

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(800).springify()}>
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
          isPressed.value = 1;
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 });
          isPressed.value = 0;
        }}
        onPress={() => {
          triggerSelectionHaptic();
          onPress();
        }}
        style={[styles.socialButtonCompact, animatedStyle, { borderColor: color.border }]}
      >
        <MaterialIcons name={icon} size={20} color={color.text} />
        <Text style={[styles.socialCompactLabel, { color: color.text }]}>{title}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { color, opacity } = useTheme();
  const { resolvedScheme } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();

  const isDark = resolvedScheme === "dark";

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["60%"], []);

  const currentLangCode = i18n.resolvedLanguage?.split('-')[0] || "en";
  const currentLangLabel = EUROPEAN_LANGUAGES.find(l => l.code === currentLangCode)?.label || "English";

  const handleSelectRole = (role: "instructor" | "studio") => {
    router.push(`/onboarding/${role}/profile`);
  };

  const handleSignOut = async () => {
    triggerSelectionHaptic();
    await signOut();
    router.replace("/sign-in");
  };

  const handleSelectLang = (code: string) => {
    triggerSelectionHaptic();
    i18n.changeLanguage(code);
    bottomSheetRef.current?.close();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={opacity.overlay}
        pressBehavior="close"
      />
    ),
    [opacity.overlay]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: "transparent" }]}> 

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.heroSection}>
          <Text
            style={[
              styles.heroTitle,
              {
                color: color.text,
                textShadowColor: isDark ? "#00000080" : color.shadow,
                textShadowOffset: { width: 0, height: 4 },
                textShadowRadius: 8,
              }
            ]}
            allowFontScaling={false}
          >
            {t("onboarding.hero.title", { defaultValue: "Join Queue" })}
          </Text>
        </Animated.View>

        <View style={styles.roleGrid}>
          <SignInStyleButton
            title={t("onboarding.roleInstructorTitle", { defaultValue: "Continue as Instructor" })}
            icon="bolt"
            delay={200}
            onPress={() => handleSelectRole("instructor")}
          />
          <SignInStyleButton
            title={t("onboarding.roleStudioTitle", { defaultValue: "Continue as Studio" })}
            icon="storefront"
            delay={300}
            onPress={() => handleSelectRole("studio")}
          />
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(500).duration(800).springify()} style={styles.footer}>
        <Pressable onPress={() => bottomSheetRef.current?.expand()} style={styles.footerButton}>
          <MaterialIcons name="language" size={22} color={color.textMuted} />
          <Text style={[styles.footerText, { color: color.textMuted }]}>{currentLangLabel}</Text>
        </Pressable>

        <View style={[styles.footerDivider, { backgroundColor: color.borderStrong }]} />

        <Pressable onPress={handleSignOut} style={styles.footerButton}>
          <Text style={[styles.footerText, { color: color.danger }]}>
            {t("auth.signOut", { defaultValue: "Sign Out" })}
          </Text>
          <MaterialIcons name="logout" size={22} color={color.danger} />
        </Pressable>
      </Animated.View>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: color.surface }}
        handleIndicatorStyle={{ backgroundColor: color.borderStrong, width: 48, height: 5 }}
      >
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: color.text }]}>
            {t("onboarding.language.select", { defaultValue: "Select Language" })}
          </Text>
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: insets.bottom + 24 }]}
        >
          {EUROPEAN_LANGUAGES.map((lang) => {
            const isActive = lang.code === currentLangCode;
            return (
              <Pressable
                key={lang.code}
                style={[styles.langOption, isActive && { backgroundColor: color.surfaceMuted }]}
                onPress={() => handleSelectLang(lang.code)}
              >
                <Text style={[styles.langOptionText, { color: isActive ? color.text : color.textMuted }]}>
                  {lang.label}
                </Text>
                {isActive && <MaterialIcons name="check" size={22} color={color.text} />}
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheet>

    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.color.appBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: "center",
  },
  heroSection: {
    marginBottom: theme.spacing.xl * 2,
    alignItems: "center",
  },
  heroTitle: {
    fontFamily: theme.fontFamily.kanitExtraBold,
    fontSize: 48,
    lineHeight: 58,
    letterSpacing: -1,
    textAlign: "center",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
    overflow: "visible",
    paddingHorizontal: 8,
  },
  heroSubtitle: {
    fontFamily: theme.fontFamily.body,
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    overflow: "visible",
  },
  roleGrid: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  socialButtonCompact: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    borderWidth: theme.borderWidth.thin,
    borderCurve: "continuous",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.color.surfaceMuted,
  },
  socialCompactLabel: {
    fontFamily: theme.fontFamily.bodyStrong,
    fontSize: 16,
    lineHeight: 20,
    overflow: "visible",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 48,
  },
  footerText: {
    fontFamily: theme.fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
    overflow: "visible",
  },
  footerDivider: {
    width: 1,
    height: 20,
  },

  sheetHeader: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  sheetTitle: {
    ...theme.typography.titleLarge,
    lineHeight: 32,
    overflow: "visible",
  },
  sheetScrollContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.xs,
  },
  langOptionText: {
    fontFamily: theme.fontFamily.bodyStrong,
    fontSize: 18,
    lineHeight: 26,
    overflow: "visible",
  }
}));
