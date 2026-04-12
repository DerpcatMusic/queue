import { useTranslation } from "react-i18next";

export function useIsRtl() {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().startsWith("he");
}
