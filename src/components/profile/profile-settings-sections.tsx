import { TouchableOpacity } from "@gorhom/bottom-sheet";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { BorderWidth, FontFamily, LetterSpacing } from "@/lib/design-system";
import { Box, Text } from "@/primitives";
import type { AppTheme } from "@/theme/theme";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

// ─── Section color coding ──────────────────────────────────────────────────
// Each settings category gets a distinct semantic color for its icon.

export type ProfileSectionTone =
  | "account"
  | "identity"
  | "operations"
  | "preferences"
  | "support"
  | "danger";

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create((theme) => ({
  // Section card
  card: {
    marginHorizontal: BrandSpacing.inset,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },

  // Sticky section header
  stickyHeader: {
    backgroundColor: theme.color.appBg,
    borderBottomWidth: BorderWidth.hairline,
    borderBottomColor: theme.color.divider,
    paddingTop: BrandSpacing.lg,
    paddingBottom: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.inset,
  },

  // Setting row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    minHeight: BrandSpacing.listItemMinHeight,
  },
  rowPressed: {
    opacity: 0.85,
  },
  divider: {
    height: BorderWidth.divider,
    backgroundColor: theme.color.divider,
  },
  // Tinted icon container (circle behind setting row icons)
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  dividerWithIcon: {
    marginLeft: BrandSpacing.md + 32 + BrandSpacing.md,
    marginRight: BrandSpacing.md,
  },
  dividerWithoutIcon: {
    marginLeft: BrandSpacing.md,
    marginRight: BrandSpacing.md,
  },

  // Action card (support / sign-out)
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.sm,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingVertical: BrandSpacing.md,
    paddingHorizontal: BrandSpacing.lg,
    minHeight: 52,
    backgroundColor: theme.color.surfaceElevated,
    ...theme.shadow.subtle,
  },
  actionCardPressed: {
    opacity: 0.8,
  },
}));

// ─── Section color map (plain string values, not stylesheet entries) ─────────

function getSectionColor(tone: ProfileSectionTone, theme: AppTheme): string {
  const c = theme.color;
  switch (tone) {
    case "account":
      return c.primary;
    case "identity":
      return c.success;
    case "operations":
      return c.secondary;
    case "preferences":
      return c.tertiary;
    case "support":
      return c.textMuted;
    case "danger":
      return c.danger;
  }
}

function getSectionIconBg(tone: ProfileSectionTone | undefined, theme: AppTheme): string {
  const c = theme.color;
  switch (tone) {
    case "account":
      return c.primarySubtle;
    case "identity":
      return c.successSubtle;
    case "operations":
      return c.secondarySubtle;
    case "preferences":
      return c.tertiarySubtle;
    case "support":
      return c.surfaceAlt;
    case "danger":
      return c.dangerSubtle;
    default:
      return c.surfaceAlt;
  }
}

// ─── Color resolver ─────────────────────────────────────────────────────────

function useProfileColors() {
  const { theme } = useUnistyles();
  return {
    iconDefault: theme.color.textMuted,
    iconAccent: theme.color.primary,
    iconDanger: theme.color.danger,
    chevron: theme.color.textMicro,
    dangerText: theme.color.danger,
    headerIcon: theme.color.textMuted,
    rolePillBg: theme.color.primary,
    rolePillText: theme.color.onPrimary,
  };
}

function useSectionColor(tone: ProfileSectionTone): string {
  const { theme } = useUnistyles();
  return getSectionColor(tone, theme);
}

// ─── Sticky Section Header ──────────────────────────────────────────────────

export function ProfileStickyHeader({
  label,
  icon,
  tone = "account",
}: {
  label: string;
  icon?: ProfileSymbolName;
  tone?: ProfileSectionTone;
}) {
  const sectionColor = useSectionColor(tone);

  return (
    <View style={styles.stickyHeader}>
      <Box flexDirection="row" alignItems="center" gap="sm">
        {icon ? <IconSymbol name={icon} size={16} color={sectionColor} /> : null}
        <Text
          variant="labelStrong"
          style={{ color: sectionColor, letterSpacing: LetterSpacing.trackingWide }}
        >
          {label.toUpperCase()}
        </Text>
      </Box>
    </View>
  );
}

// ─── Legacy Section Header (for non-StickyList usage) ───────────────────────

export function ProfileSectionHeader({
  label,
  description,
  icon,
  flush = false,
  tone = "account",
}: {
  label: string;
  description?: string;
  icon?: ProfileSymbolName;
  flush?: boolean;
  tone?: ProfileSectionTone;
}) {
  const { i18n } = useTranslation();
  const sectionColor = useSectionColor(tone);
  const isHebrew = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he");
  const headerFontFamily = isHebrew ? FontFamily.kanitBold : FontFamily.displayBold;

  return (
    <Box gap="xs" pt="xl" pb="sm" {...(!flush ? { px: "inset" } : {})}>
      <Box flexDirection="row" alignItems="center" gap="sm">
        {icon ? <IconSymbol name={icon} size={16} color={sectionColor} /> : null}
        <Text
          variant="labelStrong"
          style={{
            fontFamily: headerFontFamily,
            fontStyle: isHebrew ? "normal" : "italic",
            letterSpacing: LetterSpacing.trackingWide,
            color: sectionColor,
          }}
        >
          {label}
        </Text>
      </Box>
      {description ? (
        <Text variant="caption" style={{ maxWidth: 540 }} color="textMuted">
          {description}
        </Text>
      ) : null}
    </Box>
  );
}

// ─── Profile Section Card ───────────────────────────────────────────────────

export function ProfileSectionCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof View>["style"];
}) {
  return (
    <KitSurface tone="elevated" padding={0} gap={0} style={[styles.card, style]}>
      {children}
    </KitSurface>
  );
}

// ─── Profile Icon Button ────────────────────────────────────────────────────

export function ProfileIconButton({
  icon,
  label,
  onPress,
  tone = "neutral",
}: {
  icon: ProfileSymbolName;
  label: string;
  onPress: () => void;
  tone?: "neutral" | "accent";
}) {
  const colors = useProfileColors();

  return (
    <IconButton
      accessibilityLabel={label}
      icon={
        <IconSymbol
          name={icon}
          size={20}
          color={tone === "accent" ? colors.iconAccent : colors.iconDefault}
        />
      }
      onPress={onPress}
      tone={tone === "accent" ? "primarySubtle" : "secondary"}
      size={40}
    />
  );
}

// ─── Profile Setting Row ────────────────────────────────────────────────────

export function ProfileSettingRow({
  title,
  subtitle,
  value,
  icon,
  accessory,
  onPress,
  tone = "default",
  sectionTone,
  showDivider = false,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: ProfileSymbolName;
  accessory?: ReactNode;
  onPress?: () => void;
  tone?: "default" | "danger" | "accent";
  sectionTone?: ProfileSectionTone;
  showDivider?: boolean;
}) {
  const colors = useProfileColors();
  const { theme } = useUnistyles();

  // Resolve icon color: explicit tone > section tone > default
  let iconColor: string;
  let iconBg: string;
  if (tone === "danger") {
    iconColor = colors.iconDanger;
    iconBg = theme.color.dangerSubtle;
  } else if (tone === "accent") {
    iconColor = colors.iconAccent;
    iconBg = theme.color.primarySubtle;
  } else if (sectionTone) {
    iconColor = getSectionColor(sectionTone, theme);
    iconBg = getSectionIconBg(sectionTone, theme);
  } else {
    iconColor = colors.iconDefault;
    iconBg = theme.color.surfaceAlt;
  }

  const dividerStyle = icon ? styles.dividerWithIcon : styles.dividerWithoutIcon;

  const content = (
    <>
      <Box
        flexDirection="row"
        alignItems={subtitle && subtitle.length > 36 ? "flex-start" : "center"}
        gap="md"
        px="md"
        py="md"
        minHeight={BrandSpacing.listItemMinHeight}
      >
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <IconSymbol name={icon} size={18} color={iconColor} />
          </View>
        ) : null}

        <Box flex={1} minWidth={0} gap="xxs">
          <Text variant="bodyMedium" color="text">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </Box>

        {value ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {value}
          </Text>
        ) : null}

        {accessory ??
          (onPress ? <IconSymbol name="chevron.right" size={14} color={colors.chevron} /> : null)}
      </Box>
      {showDivider ? <View style={[styles.divider, dividerStyle]} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={[title, subtitle, value].filter(Boolean).join(". ")}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(". ")}
      onPress={onPress}
      style={(state) => [
        styles.row as ViewStyle,
        state.pressed && (styles.rowPressed as ViewStyle),
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

// ─── Action Cards ───────────────────────────────────────────────────────────

export function ProfileSupportCard({
  icon,
  title,
  onPress,
  fullWidth = false,
}: {
  icon: ProfileSymbolName;
  title: string;
  onPress?: () => void;
  fullWidth?: boolean;
}) {
  const { theme } = useUnistyles();

  const iconEl = (
    <View style={[styles.iconContainer, { backgroundColor: theme.color.surfaceAlt }]}>
      <IconSymbol name={icon} size={18} color={theme.color.textMuted} />
    </View>
  );

  if (!onPress) {
    return (
      <View style={[styles.actionCard as ViewStyle, fullWidth && { flex: 1 }]}>
        {iconEl}
        <Text variant="bodyMedium" color="text" style={{ fontWeight: "600" }}>
          {title}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={(state) => [
        styles.actionCard as ViewStyle,
        fullWidth && { flex: 1 },
        state.pressed && (styles.actionCardPressed as ViewStyle),
      ]}
    >
      {iconEl}
      <Text variant="bodyMedium" color="text" style={{ fontWeight: "600" }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function ProfileSignOutButton({ title, onPress }: { title: string; onPress?: () => void }) {
  const colors = useProfileColors();

  if (!onPress) {
    return (
      <View style={styles.actionCard as ViewStyle}>
        <IconSymbol name="logout" size={20} color={colors.iconDanger} />
        <Text variant="bodyMedium" style={{ color: colors.dangerText, fontWeight: "700" }}>
          {title}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={(state) => [
        styles.actionCard as ViewStyle,
        state.pressed && (styles.actionCardPressed as ViewStyle),
      ]}
    >
      <IconSymbol name="logout" size={20} color={colors.iconDanger} />
      <Text variant="bodyMedium" style={{ color: colors.dangerText, fontWeight: "700" }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
