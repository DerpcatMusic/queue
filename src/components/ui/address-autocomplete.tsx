import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type ColorValue, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import {
  fetchPlaceAutocomplete,
  fetchPlaceCoordinates,
  isGooglePlacesConfigured,
  type PlaceCoordinates,
  type PlacePrediction,
  resetPlacesSession,
} from "@/lib/google-places";

type AddressAutocompleteProps = {
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelected: (coords: PlaceCoordinates) => void;
  placeholder?: string;
  placeholderTextColor?: ColorValue;
  borderColor?: ColorValue;
  textColor?: ColorValue;
  backgroundColor?: ColorValue;
  surfaceColor?: ColorValue;
  mutedTextColor?: ColorValue;
};

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

/// Address input with Google Places autocomplete suggestions.
export function AddressAutocomplete({
  value,
  onChangeText,
  onPlaceSelected,
  placeholder,
  placeholderTextColor,
  borderColor,
  textColor,
  backgroundColor,
  surfaceColor,
  mutedTextColor,
}: AddressAutocompleteProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRef = useRef(false);
  const placesAvailable = isGooglePlacesConfigured();

  const fetchPredictions = useCallback(
    async (query: string) => {
      if (query.trim().length < MIN_QUERY_LENGTH || !placesAvailable) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await fetchPlaceAutocomplete(query);
        setPredictions(results);
        setIsOpen(results.length > 0);
      } catch {
        setPredictions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [placesAvailable],
  );

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void fetchPredictions(value);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchPredictions]);

  const handleSelect = useCallback(
    async (prediction: PlacePrediction) => {
      suppressRef.current = true;
      onChangeText(prediction.fullText);
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(true);

      try {
        const coords = await fetchPlaceCoordinates(prediction.placeId);
        if (coords) {
          onPlaceSelected(coords);
        }
      } finally {
        setIsLoading(false);
        resetPlacesSession();
      }
    },
    [onChangeText, onPlaceSelected],
  );

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("common.address")}
        placeholderTextColor={placeholderTextColor ?? palette.textMuted}
        style={[
          styles.input,
          {
            borderColor: borderColor ?? palette.border,
            color: textColor ?? palette.text,
            backgroundColor: backgroundColor ?? palette.surface,
          },
        ]}
        autoCorrect={false}
        autoCapitalize="words"
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        returnKeyType="search"
        clearButtonMode="while-editing"
        selectionColor={palette.primary}
        cursorColor={palette.primary}
      />
      {isLoading ? (
        <View style={[styles.loadingBar, { backgroundColor: palette.primarySubtle }]}>
          <ThemedText type="micro" style={{ color: mutedTextColor ?? palette.textMuted }}>
            {t("common.searching")}
          </ThemedText>
        </View>
      ) : null}
      {isOpen && predictions.length > 0 ? (
        <View
          style={[
            styles.dropdown,
            {
              borderColor: borderColor ?? palette.border,
              backgroundColor: surfaceColor ?? palette.surface,
            },
          ]}
        >
          {predictions.map((prediction) => (
            <Pressable
              key={prediction.placeId}
              style={({ pressed }) => [
                styles.suggestion,
                {
                  backgroundColor: pressed ? palette.primarySubtle : palette.surface,
                },
              ]}
              onPress={() => {
                void handleSelect(prediction);
              }}
            >
              <ThemedText type="defaultSemiBold" numberOfLines={1}>
                {prediction.mainText}
              </ThemedText>
              {prediction.secondaryText ? (
                <ThemedText
                  type="caption"
                  numberOfLines={1}
                  style={{
                    color: mutedTextColor ?? palette.textMuted,
                  }}
                >
                  {prediction.secondaryText}
                </ThemedText>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 10,
  },
  input: {
    borderWidth: BorderWidth.thin,
    borderRadius: BrandRadius.input,
    borderCurve: "continuous",
    minHeight: BrandSpacing.iconContainer + BrandSpacing.xs,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
  },
  loadingBar: {
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.xs,
    borderRadius: BrandRadius.cardSubtle,
    marginTop: BrandSpacing.xs,
  },
  dropdown: {
    borderWidth: BorderWidth.thin,
    borderRadius: BrandRadius.input,
    borderCurve: "continuous",
    marginTop: BrandSpacing.xs,
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    gap: BrandSpacing.xs,
  },
});
