import type { SymbolViewProps } from "expo-symbols";
import Animated, { FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { IconSize } from "@/lib/design-system";
import { Box } from "@/primitives";
import { Motion, Spring } from "@/theme/theme";

type EmptyStateAction = {
  label: string;
  onPress: () => void;
};

type EmptyStateProps = {
  /** SF Symbol name for the illustration. */
  icon: SymbolViewProps["name"];
  title: string;
  body?: string;
  action?: EmptyStateAction;
};

/**
 * Full-height empty state with an animated SF Symbol, title, body text,
 * and an optional primary CTA. Use instead of bare muted text strings.
 *
 * @example
 * <EmptyState
 *   icon="calendar.badge.exclamationmark"
 *   title="Nothing booked yet"
 *   body="18 open jobs match your zone right now."
 *   action={{ label: "Browse Jobs", onPress: () => router.push('/jobs') }}
 * />
 */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const { color } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(Motion.slow).springify().damping(Spring.standard.damping)}
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.lg,
        paddingHorizontal: BrandSpacing.xl,
        paddingVertical: BrandSpacing.xxl,
      }}
    >
      <AppSymbol name={icon} size={IconSize.emptyState} tintColor={color.textMicro} />
      <Box style={{ gap: BrandSpacing.xs, alignItems: "center" }}>
        <ThemedText type="title" style={{ textAlign: "center", color: color.text }} selectable>
          {title}
        </ThemedText>
        {body ? (
          <ThemedText
            type="caption"
            style={{ textAlign: "center", color: color.textMuted }}
            selectable
          >
            {body}
          </ThemedText>
        ) : null}
      </Box>
      {action ? <ActionButton label={action.label} onPress={action.onPress} /> : null}
    </Animated.View>
  );
}
