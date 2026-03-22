import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type NativeSearchFieldProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  clearAccessibilityLabel?: string;
  size?: "md" | "sm";
  containerStyle?: StyleProp<ViewStyle>;
};

export function NativeSearchField({
  value,
  onChangeText,
  placeholder,
  clearAccessibilityLabel = "Clear search",
  size = "md",
  containerStyle,
  style,
  ...rest
}: NativeSearchFieldProps) {
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const surfaceColor =
    resolvedScheme === "dark"
      ? (palette.surfaceElevated as string)
      : (palette.surfaceAlt as string);
  const metrics =
    size === "sm"
      ? {
          containerMinHeight: 48,
          inputMinHeight: 44,
          horizontalPadding: BrandSpacing.md,
          iconSize: 18,
          clearIconSize: 17,
          radius: 18,
        }
      : {
          containerMinHeight: 52,
          inputMinHeight: 48,
          horizontalPadding: BrandSpacing.lg,
          iconSize: 19,
          clearIconSize: 18,
          radius: BrandRadius.input,
        };

  return (
    <Animated.View
      layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
      style={[
        {
          minHeight: metrics.containerMinHeight,
          borderWidth: 0,
          borderRadius: metrics.radius,
          borderCurve: "continuous",
          backgroundColor: surfaceColor,
          paddingHorizontal: metrics.horizontalPadding,
          flexDirection: "row",
          alignItems: "center",
          gap: BrandSpacing.sm,
        },
        containerStyle,
      ]}
    >
      <MaterialIcons name="search" size={metrics.iconSize} color={palette.textMuted as string} />
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
            minHeight: metrics.inputMinHeight,
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
          <MaterialIcons
            name="close"
            size={metrics.clearIconSize}
            color={palette.textMuted as string}
          />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
