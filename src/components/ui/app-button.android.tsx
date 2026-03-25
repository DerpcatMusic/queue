import { requireOptionalNativeModule } from "expo";

import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

import { AppButtonFallback } from "./app-button.shared";
import type { AppButtonProps } from "./app-button.types";

function canUseNativeButton(props: AppButtonProps) {
  return Boolean(
    props.native !== false &&
      props.label &&
      !props.icon &&
      !props.loading &&
      props.shape !== "square",
  );
}

function hasExpoUIModule() {
  return requireOptionalNativeModule("ExpoUI") != null;
}

export function AppButton(props: AppButtonProps) {
  const theme = useTheme();

  if (!canUseNativeButton(props) || !hasExpoUIModule()) {
    return <AppButtonFallback {...props} />;
  }

  let compose: any = null;
  let modifiers: any = null;

  try {
    compose = require("@expo/ui/jetpack-compose");
    modifiers = require("@expo/ui/jetpack-compose/modifiers");
  } catch {
    return <AppButtonFallback {...props} />;
  }

  const { Button, FilledTonalButton, Host, Shape } = compose;
  const { fillMaxWidth } = modifiers;

  if (!Button || !FilledTonalButton || !Host || !Shape || !fillMaxWidth) {
    return <AppButtonFallback {...props} />;
  }

  const {
    onPress,
    tone = "primary",
    disabled = false,
    fullWidth = false,
    size = "md",
    radius,
    colors,
  } = props;
  const label = props.label!;

  const ButtonComponent = tone === "primary" ? Button : FilledTonalButton;
  const resolvedRadius = radius ?? BrandRadius.button;
  const containerColor =
    colors?.backgroundColor ?? (tone === "primary" ? theme.color.primary : theme.color.surfaceAlt);
  const contentColor =
    colors?.labelColor ?? (tone === "primary" ? theme.color.onPrimary : theme.color.text);
  const disabledContainerColor =
    colors?.disabledBackgroundColor ??
    (tone === "primary" ? theme.color.primaryPressed : theme.color.surface);
  const disabledContentColor =
    colors?.disabledLabelColor ??
    (tone === "primary" ? theme.color.onPrimary : theme.color.textMuted);
  const verticalPadding = size === "lg" ? BrandSpacing.sm + BrandSpacing.xxs : BrandSpacing.sm;
  const horizontalPadding = BrandSpacing.component;

  return (
    <Host
      matchContents={!fullWidth}
      colorScheme={theme.scheme}
      style={fullWidth ? { width: "100%", alignSelf: "stretch" } : undefined}
    >
      <ButtonComponent
        enabled={!disabled}
        onClick={() => onPress()}
        colors={{
          containerColor,
          contentColor,
          disabledContainerColor,
          disabledContentColor,
        }}
        contentPadding={{
          start: horizontalPadding,
          end: horizontalPadding,
          top: verticalPadding,
          bottom: verticalPadding,
        }}
        shape={Shape.RoundedCorner({
          cornerRadii: {
            topStart: resolvedRadius,
            topEnd: resolvedRadius,
            bottomStart: resolvedRadius,
            bottomEnd: resolvedRadius,
          },
        })}
        modifiers={fullWidth ? [fillMaxWidth()] : []}
      >
        {label}
      </ButtonComponent>
    </Host>
  );
}
