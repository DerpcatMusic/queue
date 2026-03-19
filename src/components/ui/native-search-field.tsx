import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, TextInput, type TextInputProps, View } from "react-native";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type NativeSearchFieldProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  clearAccessibilityLabel?: string;
};

export function NativeSearchField({
  value,
  onChangeText,
  placeholder,
  clearAccessibilityLabel = "Clear search",
  style,
  ...rest
}: NativeSearchFieldProps) {
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const surfaceColor =
    resolvedScheme === "dark"
      ? (palette.surfaceElevated as string)
      : (palette.surfaceAlt as string);
  const borderColor =
    resolvedScheme === "dark" ? (palette.borderStrong as string) : (palette.border as string);

  return (
    <View
      style={{
        minHeight: 52,
        borderWidth: 1,
        borderColor,
        borderRadius: BrandRadius.input,
        borderCurve: "continuous",
        backgroundColor: surfaceColor,
        paddingHorizontal: BrandSpacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.sm,
        shadowColor: "#000000",
        shadowOpacity: resolvedScheme === "dark" ? 0.16 : 0.03,
        shadowRadius: resolvedScheme === "dark" ? 14 : 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: resolvedScheme === "dark" ? 2 : 1,
      }}
    >
      <MaterialIcons name="search" size={19} color={palette.textMuted as string} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={palette.primary as string}
        cursorColor={palette.primary as string}
        underlineColorAndroid="transparent"
        style={[
          {
            flex: 1,
            minHeight: 48,
            color: palette.text,
            fontSize: 16,
            fontWeight: "500",
            includeFontPadding: false,
            paddingVertical: 0,
          },
          style,
        ]}
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <MaterialIcons name="close" size={18} color={palette.textMuted as string} />
        </Pressable>
      ) : null}
    </View>
  );
}
