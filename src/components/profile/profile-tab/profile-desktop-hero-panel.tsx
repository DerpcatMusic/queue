import { memo } from "react";
import { StyleSheet } from "react-native-unistyles";
import { ProfileVerifiedBadge } from "@/components/profile/profile-verified-badge";
import { ActionButton } from "@/components/ui/action-button";
import { KitStatusBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { Box, Text } from "@/primitives";
import type { ProfileHeroAction } from "./profile-hero-utils";

type ProfileDesktopHeroPanelProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  summary: string;
  statusLabel: string;
  statusTone?: "neutral" | "success" | "warning";
  metaLabel?: string | undefined;
  primaryAction: ProfileHeroAction;
  secondaryAction?: ProfileHeroAction | undefined;
  onOpenSwitcher?: () => void;
  switcherActionLabel?: string;
  isVerified?: boolean;
};

const s = StyleSheet.create((theme) => ({
  panel: {
    borderRadius: BrandRadius.soft,
    borderCurve: "continuous",
    backgroundColor: theme.color.surfaceElevated,
    paddingHorizontal: BrandSpacing.xl,
    paddingVertical: BrandSpacing.xl,
    gap: BrandSpacing.lg,
    ...theme.shadow.hero,
  },
  roleLabel: {
    ...BrandType.micro,
    color: theme.color.primary,
  },
  name: {
    ...BrandType.headingDisplay,
    color: theme.color.text,
    flexShrink: 1,
  },
  summary: {
    ...BrandType.body,
    color: theme.color.textMuted,
  },
  metaLabel: {
    ...BrandType.caption,
    color: theme.color.textMicro,
  },
  actionColors: {
    backgroundColor: theme.color.primary,
    pressedBackgroundColor: theme.color.primaryPressed,
    disabledBackgroundColor: theme.color.primarySubtle,
    labelColor: theme.color.onPrimary,
    disabledLabelColor: theme.color.textMicro,
  },
}));

export const ProfileDesktopHeroPanel = memo(function ProfileDesktopHeroPanel({
  profileName,
  roleLabel,
  profileImageUrl,
  summary,
  statusLabel,
  statusTone = "neutral",
  metaLabel,
  primaryAction,
  secondaryAction,
  onOpenSwitcher,
  switcherActionLabel,
  isVerified = false,
}: ProfileDesktopHeroPanelProps) {
  return (
    <Box style={s.panel}>
      <Box flexDirection="row" alignItems="center" gap="componentPadding">
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          size={BrandSpacing.iconContainerLarge + BrandSpacing.xs + BrandSpacing.xs / 2}
          roundedSquare
        />
        <Box flex={1} gap="xs">
          <Text style={s.roleLabel}>{roleLabel}</Text>
          <Box flexDirection="row" alignItems="center" gap="xs">
            <Text numberOfLines={2} style={s.name}>
              {profileName}
            </Text>
            {isVerified ? <ProfileVerifiedBadge /> : null}
          </Box>
        </Box>
      </Box>

      <Box gap="sm">
        <KitStatusBadge
          label={statusLabel}
          tone={
            statusTone === "success" ? "success" : statusTone === "warning" ? "warning" : "neutral"
          }
          showDot
        />
        {summary ? <Text style={s.summary}>{summary}</Text> : null}
        {metaLabel ? <Text style={s.metaLabel}>{metaLabel}</Text> : null}
      </Box>

      <Box flexDirection="row" gap="sm">
        <Box flex={1}>
          <ActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            fullWidth
            colors={s.actionColors}
          />
        </Box>
        {onOpenSwitcher ? (
          <Box flex={1}>
            <ActionButton
              label={switcherActionLabel ?? "Switch account"}
              onPress={onOpenSwitcher}
              tone="secondary"
              fullWidth
            />
          </Box>
        ) : null}
        {secondaryAction ? (
          <Box flex={1}>
            <ActionButton
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              tone="secondary"
              fullWidth
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});
