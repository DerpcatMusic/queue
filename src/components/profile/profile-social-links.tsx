import * as ExpoLinking from "expo-linking";
import { View } from "react-native";

import { KitSocialIconButton } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";

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
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm, flexWrap: "wrap" }}
    >
      {activeFields.map((field) => (
        <KitSocialIconButton
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
    </View>
  );
}
