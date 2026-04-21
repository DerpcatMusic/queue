import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, KeyboardAvoidingView, Platform, Pressable, Alert, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Animated, { 
  FadeInDown, 
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { useMutation } from "convex/react";

import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { QueueMap } from "@/components/maps/queue-map";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import {
  useInstructorProfileStorage,
  useLocationStorage,
  useStudioProfileStorage,
} from "@/hooks/use-onboarding-storage";
import { api } from "@/convex/_generated/api";
import type { PlaceCoordinates } from "@/lib/google-places";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AppStyleButton({ title, onPress, disabled, loading, style }: { 
  title: string; onPress: () => void; disabled: boolean; loading?: boolean; style?: any 
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: disabled && !loading ? theme.color.surfaceMuted : theme.color.primary,
    opacity: isPressed.value === 1 ? 0.85 : 1,
  }));

  return (
    <AnimatedPressable
      disabled={disabled && !loading}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); isPressed.value = 1; }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); isPressed.value = 0; }}
      onPress={() => { triggerSelectionHaptic(); onPress(); }}
      style={[styles.appButton, style, animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.color.onPrimary} />
      ) : (
        <Text style={[styles.appButtonText, { color: disabled ? theme.color.textMuted : theme.color.onPrimary }]}>{title}</Text>
      )}
    </AnimatedPressable>
  );
}

async function fetchCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  const locationModule = await import("expo-location");
  const permission = await locationModule.getForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    const requested = await locationModule.requestForegroundPermissionsAsync();
    if (requested.status !== "granted") {
      throw new Error("Location permission denied");
    }
  }
  const position = await locationModule.getCurrentPositionAsync({
    accuracy: locationModule.Accuracy.Highest,
  });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceCoordinates> {
  const fallbackAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  try {
    const locationModule = await import("expo-location");
    const results = await locationModule.reverseGeocodeAsync({ latitude, longitude });
    const region = results[0];
    if (!region) {
      return {
        latitude,
        longitude,
        formattedAddress: fallbackAddress,
      };
    }

    const parts = [
      region.streetNumber ? `${region.streetNumber} ${region.street}` : region.street,
      region.city,
      region.region,
      region.country,
    ].filter(Boolean);

    return {
      latitude,
      longitude,
      formattedAddress: parts.join(", ") || fallbackAddress,
      ...(region.city ? { city: region.city } : {}),
      ...(region.street ? { street: region.street } : {}),
      ...(region.streetNumber ? { streetNumber: String(region.streetNumber) } : {}),
      ...(region.postalCode ? { postalCode: region.postalCode } : {}),
      ...(region.country ? { country: region.country } : {}),
      ...(region.isoCountryCode ? { countryCode: region.isoCountryCode.toUpperCase() } : {}),
    };
  } catch {
    return {
      latitude,
      longitude,
      formattedAddress: fallbackAddress,
    };
  }
}

export default function LocationScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, save } = useLocationStorage();
  const { data: studioProfile } = useStudioProfileStorage();
  const { data: instructorProfile } = useInstructorProfileStorage();
  
  const completeOnboarding = useMutation(api.onboarding.studio.completeStudioOnboarding);
  const completeInstructorOnboarding = useMutation(api.onboarding.instructor.completeInstructorOnboarding);

  const [address, setAddress] = useState(data.address);
  const [lat, setLat] = useState<number | undefined>(data.latitude ?? undefined);
  const [lng, setLng] = useState<number | undefined>(data.longitude ?? undefined);
  const [country, setCountry] = useState<string | null>(data.country ?? null);
  const [countryCode, setCountryCode] = useState<string | null>(data.countryCode ?? null);
  const [isResolved, setIsResolved] = useState(!!data.address.trim());
  const [isGpsFetching, setIsGpsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStudio = role === "studio";

  // Persist on change
  useEffect(() => { 
    save({ address }); 
    if (address.trim()) setIsResolved(true); 
  }, [address]);
  useEffect(() => { save({ latitude: lat ?? null }); }, [lat]);
  useEffect(() => { save({ longitude: lng ?? null }); }, [lng]);
  useEffect(() => { save({ country: country ?? null }); }, [country]);
  useEffect(() => { save({ countryCode: countryCode ?? null }); }, [countryCode]);

  const handlePlaceSelected = async (coords: PlaceCoordinates) => {
    setAddress(coords.formattedAddress);
    setLat(coords.latitude);
    setLng(coords.longitude);
    setCountry(coords.country ?? null);
    setCountryCode(coords.countryCode ?? null);
    setIsResolved(true);
  };

  const handleGpsPress = async () => {
    triggerSelectionHaptic();
    setIsGpsFetching(true);

    try {
      const { latitude, longitude } = await fetchCurrentPosition();
      const resolved = await reverseGeocode(latitude, longitude);
      setAddress(resolved.formattedAddress);
      setLat(latitude);
      setLng(longitude);
      setCountry(resolved.country ?? null);
      setCountryCode(resolved.countryCode ?? null);
      setIsResolved(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("onboarding.location.gpsFailed", { defaultValue: "Could not access GPS" });
      Alert.alert(t("common.error", { defaultValue: "Error" }), message);
    } finally {
      setIsGpsFetching(false);
    }
  };

  const handleContinue = async () => {
    if (!isResolved || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isStudio) {
        await completeOnboarding({
          studioName: studioProfile.studioName ?? "My Studio",
          address: address,
          ...(country ? { addressCountry: country } : {}),
          ...(countryCode ? { addressCountryCode: countryCode } : {}),
          latitude: lat ?? undefined,
          longitude: lng ?? undefined,
          sports: studioProfile.sports ?? [],
        } as any);
      } else {
        await completeInstructorOnboarding({
          displayName: instructorProfile.displayName ?? "Instructor",
          address,
          ...(country ? { addressCountry: country } : {}),
          ...(countryCode ? { addressCountryCode: countryCode } : {}),
          notificationsEnabled: false,
          sports: instructorProfile.sports ?? [],
          ...(instructorProfile.bio ? { bio: instructorProfile.bio } : {}),
          ...(lat !== undefined ? { latitude: lat } : {}),
          ...(lng !== undefined ? { longitude: lng } : {}),
        });
      }
      router.replace(`/onboarding/verification?role=${role}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("onboarding.location.submitError", { defaultValue: "Failed to complete setup" });
      Alert.alert(t("common.error", { defaultValue: "Error" }), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = address.trim().length > 0 && isResolved;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Animated.Text entering={FadeInDown.delay(100)} style={[styles.title, { color: theme.color.text }]}>
          {t("onboarding.location.title", { defaultValue: "Where are you based?" })}
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.searchSection}>
        <Text style={[styles.label, { color: theme.color.text }]}>{t("onboarding.studioAddress", { defaultValue: "Address" })}</Text>
        <AddressAutocomplete
          value={address}
          onChangeText={(val) => { setAddress(val); setIsResolved(false); }}
          onPlaceSelected={handlePlaceSelected}
          placeholder={t("onboarding.location.search", { defaultValue: "Search address..." })}
          placeholderTextColor={theme.color.textMuted}
          borderColor={theme.color.border}
          textColor={theme.color.text}
          backgroundColor={theme.color.surface}
          surfaceColor={theme.color.surfaceElevated}
          mutedTextColor={theme.color.textMuted}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)} style={styles.mapContainer}>
        <View style={styles.mapWrapper}>
          <QueueMap
            mode="pinDrop"
            pin={lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null}
            selectedZoneIds={[]}
            focusZoneId={null}
            onPressMap={(pin) => {
              void (async () => {
                const resolved = await reverseGeocode(pin.latitude, pin.longitude);
                await handlePlaceSelected(resolved);
              })();
            }}
            showGpsButton={false}
            showAttributionButton={false}
          />
          
          <Pressable 
            style={({ pressed }) => [
              styles.gpsButton, 
              { backgroundColor: theme.color.surface, opacity: pressed || isGpsFetching ? 0.85 : 1 }
            ]} 
            onPress={handleGpsPress}
            disabled={isGpsFetching}
          >
            {isGpsFetching ? (
              <ActivityIndicator size="small" color={theme.color.primary} />
            ) : (
              <MaterialIcons name="my-location" size={22} color={theme.color.primary} />
            )}
            <Text style={[styles.gpsButtonText, { color: theme.color.text }]}>
              {isGpsFetching 
                ? t("onboarding.location.locating", { defaultValue: "Locating..." })
                : t("onboarding.location.useGps", { defaultValue: "Use current location" })
              }
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)} style={styles.footer}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
          <MaterialIcons name="arrow-back" size={24} color={theme.color.danger} />
        </Pressable>

        <AppStyleButton 
          title={isSubmitting ? t("onboarding.location.saving", { defaultValue: "Setting up..." }) : t("common.continue", { defaultValue: "Continue" })}
          onPress={handleContinue}
          disabled={!isComplete}
          loading={isSubmitting}
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
    marginBottom: theme.spacing.lg,
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
  searchSection: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontFamily: theme.fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: theme.spacing.xs,
    marginLeft: 2,
  },
  mapContainer: {
    flex: 1,
    minHeight: 120,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  mapWrapper: {
    flex: 1,
    position: "relative",
  },
  gpsButton: {
    position: "absolute",
    bottom: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  gpsButtonText: {
    fontFamily: theme.fontFamily.bodyStrong,
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row", 
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
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