import type { TextInputProps } from "react-native";
import type {
  ProfileSocialKey,
  ProfileSocialLinks,
} from "@/components/profile/profile-social-links";

export type EditableExtraField = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
};

export type ProfileEditorFormProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  bioDraft: string;
  onBioDraftChange: (value: string) => void;
  socialLinksDraft: ProfileSocialLinks;
  onSocialLinkChange: (key: ProfileSocialKey, value: string) => void;
  sportsDraft: string[];
  onToggleSport: (sport: string) => void;
  onChangePhoto: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  isChangingPhoto?: boolean;
  statusLabel?: string | null;
  searchPlaceholder: string;
  sportsTitle: string;
  sportsEmptyHint: string;
  extraField?: EditableExtraField;
};
