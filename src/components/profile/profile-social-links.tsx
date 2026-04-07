import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import * as ExpoLinking from "expo-linking";
import { Pressable, View } from "react-native";
import { AppSymbol } from "@/components/ui/app-symbol";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { IconSize } from "@/lib/design-system";
import { Box } from "@/primitives";
const BRIGHT_LIME = "#CCFF00";

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
  size = BrandSpacing.iconContainer,
}: {
  accessibilityLabel: string;
  icon: BrandIconName | "website";
  onPress?: () => void;
  active?: boolean;
  size?: number;
}) {
  const { color: palette } = useTheme();
  const iconSize = Math.max(IconSize.xs, Math.round(size * 0.44));
  const backgroundColor = active ? BRIGHT_LIME : palette.surfaceElevated;
  const pressedBackgroundColor = active ? "#D9FF4D" : palette.surfaceAlt;
  const tintColor = active ? "#161E00" : palette.textMuted;

  const circle = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: BrandRadius.full,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
      }}
    >
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
      style={({ pressed }) => ({
        borderRadius: BrandRadius.full,
        backgroundColor: pressed ? pressedBackgroundColor : backgroundColor,
      })}
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
