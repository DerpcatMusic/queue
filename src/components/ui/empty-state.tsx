import type { SymbolViewProps } from "expo-symbols";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitButton } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type EmptyStateAction = {
  label: string;
  /** SF Symbol name - optional; button renders without icon if absent. */
  icon?: SymbolViewProps["name"];
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
 *   action={{ label: "Browse Jobs", icon: "briefcase", onPress: () => router.push('/jobs') }}
 * />
 */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const palette = useBrand();

  return (
    <Animated.View
      entering={FadeIn.duration(400).springify().damping(20)}
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.lg,
        paddingHorizontal: BrandSpacing.xl,
        paddingVertical: BrandSpacing.xxl,
      }}
    >
      <AppSymbol name={icon} size={52} tintColor={palette.textMicro as string} />
      <View style={{ gap: BrandSpacing.xs, alignItems: "center" }}>
        <ThemedText type="title" style={{ textAlign: "center", color: palette.text }} selectable>
          {title}
        </ThemedText>
        {body ? (
          <ThemedText
            type="caption"
            style={{ textAlign: "center", color: palette.textMuted }}
            selectable
          >
            {body}
          </ThemedText>
        ) : null}
      </View>
      {action ? (
        <KitButton
          label={action.label}
          {...(action.icon !== undefined ? { icon: action.icon } : {})}
          onPress={action.onPress}
        />
      ) : null}
    </Animated.View>
  );
}
