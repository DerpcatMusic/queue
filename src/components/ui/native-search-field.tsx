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
import { useTheme } from "@/hooks/use-theme";

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
  const theme = useTheme();
  const surfaceColor =
    theme.scheme === "dark" ? theme.color.surfaceElevated : theme.color.surfaceAlt;
  const metrics = size === "sm" ? SEARCH_SIZE_SM : SEARCH_SIZE_MD;
  const pressedBackgroundColor =
    theme.scheme === "dark" ? theme.color.surface : theme.color.surfaceElevated;
  const clearButtonBackground = theme.color.textMuted;

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
      <MaterialIcons name="search" size={metrics.iconSize} color={theme.color.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textMuted}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={theme.color.primary}
        cursorColor={theme.color.primary}
        underlineColorAndroid="transparent"
        style={[
          {
            flex: 1,
            minWidth: 0,
            minHeight: metrics.inputMinHeight,
            ...BrandType.bodyMedium,
            color: theme.color.text,
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
          style={({ pressed }) => ({
            borderRadius: BrandRadius.pill,
            backgroundColor: pressed ? pressedBackgroundColor : clearButtonBackground,
          })}
        >
          <MaterialIcons name="close" size={metrics.clearIconSize} color={theme.color.onPrimary} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
