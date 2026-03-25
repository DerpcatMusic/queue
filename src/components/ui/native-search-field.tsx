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
  animateLayout?: boolean;
};

export function NativeSearchField({
  value,
  onChangeText,
  placeholder,
  clearAccessibilityLabel = "Clear search",
  size = "md",
  containerStyle,
  animateLayout = false,
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
  const pressedBackgroundColor =
    resolvedScheme === "dark" ? (palette.surface as string) : (palette.surfaceElevated as string);
  const clearButtonBackground = palette.textMuted as string;

  return (
    <Animated.View
      {...(animateLayout
        ? {
            layout: LinearTransition.duration(220).reduceMotion(ReduceMotion.System),
          }
        : {})}
      style={[
        {
          width: "100%",
          minWidth: 0,
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
            minWidth: 0,
            minHeight: metrics.inputMinHeight,
            ...BrandType.bodyMedium,
            includeFontPadding: false,
          },
          style,
        ]}
        className="text-brand"
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={({ pressed }) => ({
            borderRadius: BrandRadius.pill,
            backgroundColor: pressed ? pressedBackgroundColor : clearButtonBackground,
          })}
        >
          <MaterialIcons
            name="close"
            size={metrics.clearIconSize}
            color={palette.onPrimary as string}
          />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
