import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type ColorValue, Pressable, TextInput, View, StyleSheet, Platform } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import {
  fetchPlaceAutocomplete,
  fetchPlaceCoordinates,
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
  const { color } = useTheme();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRef = useRef(false);
  const placesAvailable = true;

  // Resolve color strings with fallbacks
  const finalBg = backgroundColor ?? color.surface;
  const finalBorder = borderColor ?? color.border;
  const finalText = textColor ?? color.text;
  const finalPlaceholder = placeholderTextColor ?? color.textMuted;
  const finalDropdownBg = surfaceColor ?? color.surfaceElevated;

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
      <View 
        style={[
          styles.inputWrapper, 
          { 
            borderColor: finalBorder as string, 
            backgroundColor: finalBg as string,
          }
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? t("common.address")}
          placeholderTextColor={finalPlaceholder as string}
          style={[
            styles.input,
            {
              color: finalText as string,
            },
          ]}
          autoCorrect={false}
          autoCapitalize="words"
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          returnKeyType="search"
          clearButtonMode="while-editing"
          selectionColor={color.primary}
          cursorColor={color.primary}
        />
      </View>
      
      {isLoading && (
        <View style={[styles.loadingBar, { backgroundColor: color.primarySubtle }]}>
          <ThemedText type="micro" style={{ color: mutedTextColor ?? color.textMuted }}>
            {t("common.searching")}
          </ThemedText>
        </View>
      )}
      
      {isOpen && predictions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              borderColor: finalBorder as string,
              backgroundColor: finalDropdownBg as string,
            },
          ]}
        >
          {predictions.map((prediction) => (
            <Pressable
              key={prediction.placeId}
              style={({ pressed }) => [
                styles.suggestion,
                {
                  backgroundColor: pressed ? color.primarySubtle : (finalDropdownBg as string),
                },
              ]}
              onPress={() => {
                void handleSelect(prediction);
              }}
            >
              <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ color: finalText as string }}>
                {prediction.mainText}
              </ThemedText>
              {prediction.secondaryText ? (
                <ThemedText
                  type="caption"
                  numberOfLines={1}
                  style={{ color: mutedTextColor ?? color.textMuted }}
                >
                  {prediction.secondaryText}
                </ThemedText>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 100,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    minHeight: 64,
    justifyContent: "center",
  },
  input: {
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
    fontSize: 18,
    lineHeight: 26,
    width: "100%",
  },
  loadingBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  dropdown: {
    position: "absolute",
    top: 68,
    left: 0,
    right: 0,
    borderWidth: 1.5,
    borderRadius: 16,
    borderCurve: "continuous",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
});