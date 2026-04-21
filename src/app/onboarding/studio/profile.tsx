import { useRouter } from "expo-router";
import { View, Text, KeyboardAvoidingView, Platform, Pressable, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Animated, { 
  FadeInDown, 
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { useStudioProfileStorage } from "@/hooks/use-onboarding-storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SolidInput({ value, onChangeText, placeholder, autoCapitalize = "none" }: any) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusVal = useSharedValue(0);
  useEffect(() => { focusVal.value = withSpring(isFocused ? 1 : 0, { damping: 20, stiffness: 200 }); }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusVal.value, [0, 1], ["rgba(255,255,255,0.25)", theme.color.primary]),
    backgroundColor: interpolateColor(focusVal.value, [0, 1], ["rgba(0,0,0,0.5)", "rgba(0,0,0,0.8)"])
  }));

  return (
    <Animated.View style={[styles.inputContainer, animatedStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.5)"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoCapitalize={autoCapitalize}
        keyboardAppearance="dark"
        style={[styles.input, { color: theme.color.text }]}
      />
    </Animated.View>
  );
}

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
      <Text style={[styles.appButtonText, { color: disabled ? theme.color.textMuted : theme.color.onPrimary }]}>
        {title}
      </Text>
    </AnimatedPressable>
  );
}

export default function StudioProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, save } = useStudioProfileStorage();

  const [studioName, setStudioName] = useState(data.studioName);

  useEffect(() => { save({ studioName }); }, [studioName]);

  const handleContinue = () => {
    router.push("/onboarding/studio/sports");
  };

  const isComplete = studioName.trim().length > 0;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Animated.Text entering={FadeInDown.delay(100)} style={[styles.title, { color: theme.color.text }]}>
          {t("onboarding.studioProfile.title", { defaultValue: "Name your studio" })}
        </Animated.Text>
      </View>

      <View style={styles.form}>
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={[styles.label, { color: theme.color.text }]}>{t("onboarding.studioName", { defaultValue: "Studio Name" })}</Text>
          <SolidInput
            value={studioName}
            onChangeText={setStudioName}
            autoCapitalize="words"
            placeholder={t("onboarding.placeholders.studioName", { defaultValue: "Harmony Yoga Studio" })}
          />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(300)} style={styles.footer}>
        <Pressable 
          onPress={() => router.back()} 
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.color.danger} />
        </Pressable>

        <AppStyleButton 
          title={t("common.continue", { defaultValue: "Continue" })} 
          onPress={handleContinue}
          disabled={!isComplete}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fontFamily.kanitExtraBold,
    fontSize: 42,
    lineHeight: 52, 
    letterSpacing: -1,
    textShadowColor: theme.color.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2, 
  },
  form: {
    gap: theme.spacing.xl,
    flex: 1,
  },
  label: {
    fontFamily: theme.fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24, 
    marginBottom: theme.spacing.xs,
    marginLeft: 2,
  },
  inputContainer: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: "center",
    height: 64,
  },
  input: {
    fontFamily: theme.fontFamily.body,
    fontSize: 20, 
    lineHeight: 28, 
    width: "100%",
  },
  footer: {
    flexDirection: "row", 
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
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
  appButton: {
    minHeight: 60, 
    borderRadius: theme.radius.xl, 
    alignItems: "center",
    justifyContent: "center",
  },
  appButtonText: {
    fontFamily: theme.fontFamily.bodyStrong,
    fontSize: 18,
    lineHeight: 26, 
  }
}));