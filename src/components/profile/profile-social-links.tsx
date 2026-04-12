import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import * as ExpoLinking from "expo-linking";
import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppSymbol } from "@/components/ui/app-symbol";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { IconSize } from "@/lib/design-system";
import { Box } from "@/primitives";

const DEFAULT_ICON_SIZE = BrandSpacing.iconContainer;

const styles = StyleSheet.create((theme) => ({
  circle: (active: boolean, size: number) => ({
    width: size,
    height: size,
    borderRadius: BrandRadius.full,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: active ? theme.color.primary : theme.color.surfaceElevated,
  }),
  pressable: (active: boolean) => ({
    borderRadius: BrandRadius.full,
    backgroundColor: active ? theme.color.primary : theme.color.surfaceElevated,
  }),
  pressablePressed: (active: boolean) => ({
    borderRadius: BrandRadius.full,
    backgroundColor: active ? theme.color.primaryPressed : theme.color.surfaceMuted,
  }),
  tint: (active: boolean) => ({
    color: active ? theme.color.onPrimary : theme.color.textMuted,
  }),
}));

export const PROFILE_SOCIAL_FIELDS = [
  {
    key: "instagram",
    label: "Instagram",
    icon: "instagram",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: "tiktok",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "whatsapp",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "facebook",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "linkedin",
  },
  {
    key: "website",
    label: "Website",
    icon: "website",
  },
] as const;

export type ProfileSocialKey = (typeof PROFILE_SOCIAL_FIELDS)[number]["key"];
export type ProfileSocialLinks = Partial<Record<ProfileSocialKey, string>>;

function toOpenableUrl(key: ProfileSocialKey, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    /^[a-z]+:\/\//i.test(trimmed) ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }

  if (key === "whatsapp") {
    const digits = trimmed.replace(/[^\d]/g, "");
    if (digits.length > 0) {
      return `https://wa.me/${digits}`;
    }
  }

  return `https://${trimmed}`;
}

type BrandIconName = "instagram" | "tiktok" | "whatsapp" | "facebook" | "linkedin";

function SocialIconButton({
  accessibilityLabel,
  icon,
  onPress,
  active = true,
  size = DEFAULT_ICON_SIZE,
}: {
  accessibilityLabel: string;
  icon: BrandIconName | "website";
  onPress?: () => void;
  active?: boolean;
  size?: number;
}) {
  const iconSize = Math.max(IconSize.xs, Math.round(size * 0.44));
  const tintStyle = styles.tint(active);
  const tintColor = tintStyle.color;

  const circle = (
    <View style={styles.circle(active, size)}>
      {icon === "website" ? (
        <AppSymbol name="globe" size={iconSize} tintColor={tintColor} />
      ) : (
        <FontAwesome5 name={icon} size={iconSize} color={tintColor} />
      )}
    </View>
  );

  if (!onPress) {
    return circle;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) =>
        pressed ? styles.pressablePressed(active) : styles.pressable(active)
      }
    >
      {circle}
    </Pressable>
  );
}

export function ProfileSocialLinksRow({
  socialLinks,
  iconSize = BrandSpacing.iconContainer - BrandSpacing.xs / 2,
}: {
  socialLinks: ProfileSocialLinks | undefined;
  iconSize?: number;
}) {
  const activeFields = PROFILE_SOCIAL_FIELDS.filter((field) => Boolean(socialLinks?.[field.key]));

  if (activeFields.length === 0) {
    return null;
  }

  return (
    <Box
      style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm, flexWrap: "wrap" }}
    >
      {activeFields.map((field) => (
        <SocialIconButton
          key={field.key}
          accessibilityLabel={field.label}
          icon={field.icon}
          size={iconSize}
          onPress={() => {
            const nextUrl = socialLinks?.[field.key]
              ? toOpenableUrl(field.key, socialLinks[field.key] as string)
              : null;
            if (nextUrl) {
              void ExpoLinking.openURL(nextUrl);
            }
          }}
        />
      ))}
    </Box>
  );
}
