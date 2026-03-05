import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { TextInput, type TextInputProps, View } from "react-native";
import { KitPressable } from "@/components/ui/kit";
import { BrandRadius } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

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

  return (
    <View
      style={{
        minHeight: 46,
        borderWidth: 1,
        borderRadius: BrandRadius.input,
        borderCurve: "continuous",
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
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
            minHeight: 42,
            color: palette.text,
            fontSize: 16,
            includeFontPadding: false,
          },
          style,
        ]}
        {...rest}
      />
      {value.length > 0 ? (
        <KitPressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          onPress={() => onChangeText("")}
          hitSlop={8}
          rippleRadius={16}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <MaterialIcons name="close" size={18} color={palette.textMuted as string} />
        </KitPressable>
      ) : null}
    </View>
  );
}
