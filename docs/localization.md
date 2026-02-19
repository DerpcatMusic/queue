# Localization Setup (English + Hebrew)

## Overview
This project now uses:
- `i18next` + `react-i18next` for translations
- `expo-localization` for device locale detection
- `@react-native-async-storage/async-storage` for persisted language preference

Supported languages:
- `en` (English)
- `he` (Hebrew)

## Files
- `i18n/index.ts`: i18n initialization, language normalization, persistence, RTL switching helpers.
- `i18n/translations/en.ts`: English translations.
- `i18n/translations/he.ts`: Hebrew translations.
- `hooks/use-app-language.ts`: language switch hook with reload when RTL direction changes.

## Runtime behavior
- On boot, app checks saved language preference.
- If no saved preference exists, app uses device locale.
- Choosing Hebrew may trigger a reload so RTL layout is applied correctly.

## Adding new translation keys
1. Add key to `i18n/translations/en.ts`.
2. Add the same key to `i18n/translations/he.ts`.
3. Use `const { t } = useTranslation()` and `t('key.path')` in UI.

## Platform config
`app.json` includes `expo-localization` plugin with `en` and `he` as supported locales and `extra.supportsRTL: true`.
