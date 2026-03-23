import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

const SEARCH_SIZE_SM = {
  containerMinHeight: BrandSpacing.controlSm + BrandSpacing.sm,
  inputMinHeight: BrandSpacing.controlSm + BrandSpacing.xxs + BrandSpacing.xxs,
  horizontalPadding: BrandSpacing.md,
  iconSize: BrandSpacing.iconSm - BrandSpacing.xxs,
  clearIconSize: BrandSpacing.iconSm - BrandSpacing.xxs,
  radius: BrandRadius.buttonSubtle,
} as const;

const SEARCH_SIZE_MD = {
  containerMinHeight: BrandSpacing.controlSm + BrandSpacing.md,
  inputMinHeight: BrandSpacing.controlSm + BrandSpacing.sm,
  horizontalPadding: BrandSpacing.lg,
  iconSize: BrandSpacing.iconSm + BrandSpacing.xxs,
  clearIconSize: BrandSpacing.iconSm - BrandSpacing.xxs,
  radius: BrandRadius.input,
} as const;

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
  const metrics = size === "sm" ? SEARCH_SIZE_SM : SEARCH_SIZE_MD;

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
            ...BrandType.bodyMedium,
            color: palette.text,
            includeFontPadding: false,
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
