import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useInstructorProfileStorage } from "@/hooks/use-onboarding-storage";
import { useTheme } from "@/hooks/use-theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AppStyleButton({ title, onPress, disabled, style }: { title: string; onPress: () => void; disabled: boolean; style?: any }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: disabled ? theme.color.surfaceMuted : theme.color.primary,
    opacity: isPressed.value === 1 ? 0.85 : 1,
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); isPressed.value = 1; }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); isPressed.value = 0; }}
      onPress={() => { triggerSelectionHaptic(); onPress(); }}
      style={[styles.appButton, style, animatedStyle]}
    >
      <Text style={[styles.appButtonText, { color: disabled ? theme.color.textMuted : theme.color.onPrimary }]}>{title}</Text>
    </AnimatedPressable>
  );
}

export default function InstructorSportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, save } = useInstructorProfileStorage();
  const [sports, setSports] = useState<string[]>(data.sports ?? []);

  const toggleSport = (sport: string) => {
    setSports((current) =>
      current.includes(sport) ? current.filter((entry) => entry !== sport) : [...current, sport],
    );
  };

  const handleContinue = () => {
    save({ sports });
    router.push("/onboarding/location?role=instructor");
  };

  const selectedCountLabel = useMemo(
    () => t("profile.settings.sports.selected", { count: sports.length, defaultValue: `${sports.length} selected` }),
    [sports.length, t],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top + 28, paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Animated.Text entering={FadeInDown.delay(100)} style={[styles.title, { color: theme.color.text }]}>
          Pick the sports you teach
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(180)} style={[styles.subtitle, { color: theme.color.textMuted }]}>
          Studios use this to understand your coverage before they review your certificates.
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.delay(240)} style={styles.form}>
        <View style={[styles.summaryPill, { backgroundColor: theme.color.primarySubtle }]}>
          <Text style={[styles.summaryPillText, { color: theme.color.primary }]}>{selectedCountLabel}</Text>
        </View>
        <SportsMultiSelect
          selectedSports={sports}
          onToggleSport={toggleSport}
          searchPlaceholder={t("profile.settings.sports.searchPlaceholder")}
          title={t("onboarding.sportsTitle", { defaultValue: "Sports" })}
          emptyHint={t("profile.settings.sports.none")}
          defaultOpen
          variant="content"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320)} style={styles.footer}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}> 
          <MaterialIcons name="arrow-back" size={24} color={theme.color.danger} />
        </Pressable>
        <AppStyleButton title={t("common.continue", { defaultValue: "Continue" })} onPress={handleContinue} disabled={sports.length === 0} style={{ flex: 1 }} />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, paddingHorizontal: theme.spacing.lg },
  header: { marginBottom: theme.spacing.lg, gap: theme.spacing.sm },
  title: {
    fontFamily: theme.fontFamily.kanitExtraBold,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: theme.fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  form: { flex: 1, gap: theme.spacing.md },
  summaryPill: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  summaryPillText: { fontFamily: theme.fontFamily.bodyStrong, fontSize: 13 },
  footer: { flexDirection: "row", gap: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl },
  backButton: {
    width: 64,
    height: 60,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.color.dangerSubtle,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  appButton: { minHeight: 60, borderRadius: theme.radius.xl, alignItems: "center", justifyContent: "center" },
  appButtonText: { fontFamily: theme.fontFamily.bodyStrong, fontSize: 18, lineHeight: 26 },
}));
