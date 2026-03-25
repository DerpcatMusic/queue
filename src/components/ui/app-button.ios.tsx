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
      !props.fullWidth &&
      props.shape !== "square" &&
      props.radius == null &&
      !props.colors?.backgroundColor &&
      !props.colors?.pressedBackgroundColor &&
      !props.colors?.disabledBackgroundColor &&
      !props.colors?.labelColor &&
      !props.colors?.disabledLabelColor,
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
  const { buttonStyle, controlSize, disabled: disabledModifier, tint } = modifiers;

  if (!Button || !Host || !buttonStyle || !controlSize || !disabledModifier || !tint) {
    return <AppButtonFallback {...props} />;
  }

  const { onPress, tone = "primary", disabled = false, size = "md", colors } = props;
  const label = props.label!;

  return (
    <Host matchContents colorScheme={theme.scheme}>
      <Button
        label={label}
        onPress={() => onPress()}
        modifiers={[
          buttonStyle(tone === "primary" ? "borderedProminent" : "bordered"),
          controlSize(size === "lg" ? "large" : "regular"),
          tint(colors?.nativeTintColor ?? theme.color.primary),
          disabledModifier(disabled),
        ]}
      />
    </Host>
  );
}
