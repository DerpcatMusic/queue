import { ProfileAddAccountStackSheet } from "@/components/profile/profile-add-account-stack-sheet";

interface InstructorAddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorAddAccountSheet({
  visible,
  onClose,
}: InstructorAddAccountSheetProps) {
  return (
    <ProfileAddAccountStackSheet
      visible={visible}
      onClose={onClose}
      pathname="/instructor/profile/add-account"
    />
  );
}
