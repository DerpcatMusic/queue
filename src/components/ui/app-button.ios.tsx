import { requireOptionalNativeModule } from "expo";

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

  let swiftUi: any = null;
  let modifiers: any = null;

  try {
    swiftUi = require("@expo/ui/swift-ui");
    modifiers = require("@expo/ui/swift-ui/modifiers");
  } catch {
    return <AppButtonFallback {...props} />;
  }

  const { Button, Host } = swiftUi;
  const {
    background,
    buttonStyle,
    controlSize,
    disabled: disabledModifier,
    frame,
    foregroundColor,
    shapes,
    tint,
  } = modifiers;

  if (
    !Button ||
    !Host ||
    !background ||
    !buttonStyle ||
    !controlSize ||
    !disabledModifier ||
    !frame ||
    !foregroundColor ||
    !shapes ||
    !tint
  ) {
    return <AppButtonFallback {...props} />;
  }

  const { onPress, tone = "primary", disabled = false, size = "md", colors, radius } = props;
  const label = props.label!;
  const hasCustomStyling = Boolean(
    radius != null ||
      colors?.backgroundColor ||
      colors?.pressedBackgroundColor ||
      colors?.disabledBackgroundColor ||
      colors?.labelColor ||
      colors?.disabledLabelColor,
  );
  const resolvedBackgroundColor =
    colors?.backgroundColor ??
    (tone === "primary" ? theme.color.primary : theme.color.surfaceMuted);
  const resolvedDisabledBackgroundColor =
    colors?.disabledBackgroundColor ??
    (tone === "primary" ? theme.color.primaryPressed : theme.color.surface);
  const resolvedLabelColor = disabled
    ? (colors?.disabledLabelColor ??
      (tone === "primary" ? theme.color.onPrimary : theme.color.textMuted))
    : (colors?.labelColor ?? (tone === "primary" ? theme.color.onPrimary : theme.color.text));
  const buttonShape =
    radius != null ? shapes.roundedRectangle({ cornerRadius: radius }) : shapes.capsule();

  return (
    <Host
      matchContents={props.fullWidth ? false : true}
      colorScheme={theme.scheme}
      style={props.fullWidth ? { width: "100%" } : undefined}
    >
      <Button
        label={label}
        onPress={() => onPress()}
        modifiers={[
          controlSize(size === "lg" ? "large" : "regular"),
          ...(props.fullWidth ? [frame({ maxWidth: Number.MAX_SAFE_INTEGER })] : []),
          ...(hasCustomStyling
            ? [
                buttonStyle("plain"),
                background(
                  disabled ? resolvedDisabledBackgroundColor : resolvedBackgroundColor,
                  buttonShape,
                ),
                foregroundColor(resolvedLabelColor),
              ]
            : [
                buttonStyle(tone === "primary" ? "borderedProminent" : "bordered"),
                tint(colors?.nativeTintColor ?? theme.color.primary),
              ]),
          disabledModifier(disabled),
        ]}
      />
    </Host>
  );
}
