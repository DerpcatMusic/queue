import { ProfileAddAccountStackSheet } from "@/components/profile/profile-add-account-stack-sheet";

interface StudioAddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function StudioAddAccountSheet({ visible, onClose }: StudioAddAccountSheetProps) {
  return (
    <ProfileAddAccountStackSheet
      visible={visible}
      onClose={onClose}
      pathname="/studio/profile/add-account"
    />
  );
}
