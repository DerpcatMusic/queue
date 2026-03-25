import { AppButton } from "./app-button";
import type { AppButtonProps } from "./app-button.types";

export type ActionButtonProps = AppButtonProps & {
  meshGradient?: boolean;
};

export function ActionButton({ meshGradient: _meshGradient, ...props }: ActionButtonProps) {
  return <AppButton {...props} />;
}
