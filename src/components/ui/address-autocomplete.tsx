import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type ColorValue, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";
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

  const palette = useBrand();

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
        selectionColor={palette.primary as string}
        cursorColor={palette.primary as string}
      />
      {isLoading ? (
        <View style={[styles.loadingBar, { backgroundColor: palette.primarySubtle }]}>
          <ThemedText style={{ color: mutedTextColor ?? palette.textMuted, fontSize: 12 }}>
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
                  backgroundColor: pressed ? palette.primarySubtle : "transparent",
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
                  numberOfLines={1}
                  style={{
                    color: mutedTextColor ?? palette.textMuted,
                    fontSize: 13,
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
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  loadingBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    marginTop: 4,
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
});
